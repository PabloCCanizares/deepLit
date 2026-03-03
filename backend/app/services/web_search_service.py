import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from pymongo import MongoClient

from app.config import settings

logger = logging.getLogger(__name__)

RUMOR_MARKERS = {
    "rumor",
    "rumour",
    "unconfirmed",
    "leak",
    "speculation",
    "sin confirmar",
    "no verificado",
}


class WebSearchService:
    def __init__(self):
        self.mongo = MongoClient(settings.MONGODB_URL)
        self.db = self.mongo[settings.DATABASE_NAME]
        self.cache = self.db["web_search_cache"]
        self._trusted_domains = self._parse_domains(settings.WEB_TRUSTED_DOMAINS)

    @staticmethod
    def _parse_domains(raw: str) -> List[str]:
        return [domain.strip().lower() for domain in (raw or "").split(",") if domain.strip()]

    @staticmethod
    def _http_json(url: str, headers: Optional[Dict] = None, timeout: int = 12) -> Dict:
        req = Request(url, headers=headers or {"User-Agent": "deepLit-web-search/1.0"})
        with urlopen(req, timeout=timeout) as response:
            payload = response.read().decode("utf-8", errors="replace")
            return json.loads(payload)

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            return (urlparse(url).netloc or "").lower().replace("www.", "")
        except Exception:
            return ""

    def _is_trusted_domain(self, domain: str) -> bool:
        if not domain:
            return False
        return any(domain == d or domain.endswith(f".{d}") for d in self._trusted_domains)

    def _is_rumor_like(self, text: str) -> bool:
        text_low = (text or "").lower()
        return any(marker in text_low for marker in RUMOR_MARKERS)

    def _score_result(self, item: Dict) -> float:
        score = 0.0
        if item.get("is_trusted_source"):
            score += 2.0
        if item.get("published_at"):
            score += 0.6
        if not item.get("rumor_flag"):
            score += 0.5
        snippet_len = len(item.get("snippet", ""))
        score += min(snippet_len / 600.0, 0.5)
        return score

    def _cache_key(self, query: str, provider: str, locale: str = "es") -> str:
        raw = f"{provider}|{locale}|{query.strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _get_cached(self, cache_key: str) -> Optional[List[Dict]]:
        now = datetime.now(timezone.utc)
        cached = self.cache.find_one({"cache_key": cache_key, "expires_at": {"$gt": now}})
        return cached.get("results") if cached else None

    def _set_cached(self, cache_key: str, query: str, provider: str, results: List[Dict]) -> None:
        ttl_minutes = max(1, int(settings.WEB_SEARCH_CACHE_TTL_MINUTES))
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=ttl_minutes)
        self.cache.update_one(
            {"cache_key": cache_key},
            {
                "$set": {
                    "cache_key": cache_key,
                    "query": query,
                    "provider": provider,
                    "results": results,
                    "created_at": now,
                    "expires_at": expires_at,
                }
            },
            upsert=True,
        )

    def _search_duckduckgo(self, query: str) -> List[Dict]:
        endpoint = "https://api.duckduckgo.com/?" + urlencode(
            {
                "q": query,
                "format": "json",
                "no_redirect": "1",
                "no_html": "1",
                "skip_disambig": "1",
            }
        )
        payload = self._http_json(endpoint)

        results: List[Dict] = []
        fetched_at = datetime.now(timezone.utc).date().isoformat()

        if payload.get("AbstractURL") and payload.get("AbstractText"):
            url = payload["AbstractURL"]
            domain = self._extract_domain(url)
            results.append(
                {
                    "title": payload.get("Heading") or payload.get("AbstractSource") or domain,
                    "url": url,
                    "domain": domain,
                    "snippet": payload.get("AbstractText", ""),
                    "published_at": None,
                    "fetched_at": fetched_at,
                }
            )

        def add_related(topics: List[Dict]) -> None:
            for topic in topics or []:
                if "Topics" in topic:
                    add_related(topic.get("Topics") or [])
                    continue
                text = topic.get("Text") or ""
                url = topic.get("FirstURL") or ""
                if not text or not url:
                    continue
                domain = self._extract_domain(url)
                title = text.split(" - ")[0].strip()
                results.append(
                    {
                        "title": title or domain,
                        "url": url,
                        "domain": domain,
                        "snippet": text,
                        "published_at": None,
                        "fetched_at": fetched_at,
                    }
                )

        add_related(payload.get("RelatedTopics") or [])
        return results

    def _search_hackernews(self, query: str) -> List[Dict]:
        endpoint = "https://hn.algolia.com/api/v1/search?" + urlencode({"query": query, "tags": "story"})
        payload = self._http_json(endpoint)
        fetched_at = datetime.now(timezone.utc).date().isoformat()
        results: List[Dict] = []
        for hit in payload.get("hits", []) or []:
            url = hit.get("url")
            title = hit.get("title") or hit.get("story_title")
            if not url or not title:
                continue
            domain = self._extract_domain(url)
            published = (hit.get("created_at") or "")[:10] or None
            results.append(
                {
                    "title": title,
                    "url": url,
                    "domain": domain,
                    "snippet": hit.get("story_text") or hit.get("comment_text") or "",
                    "published_at": published,
                    "fetched_at": fetched_at,
                }
            )
        return results

    def search(
        self,
        query: str,
        provider: Optional[str] = None,
        force_online: bool = False,
        runtime_mode: Optional[str] = None,
    ) -> Dict:
        mode = (runtime_mode or "").strip().lower()
        offline = settings.OFFLINE and not force_online
        if mode == "offline":
            offline = True
        elif mode == "online":
            offline = False

        selected_provider = (provider or settings.WEB_SEARCH_PROVIDER or "duckduckgo").strip().lower()
        if selected_provider not in {"duckduckgo", "hackernews"}:
            selected_provider = "duckduckgo"

        if offline:
            return {
                "mode": "offline",
                "provider": selected_provider,
                "results": [],
                "summary": "Modo offline activo: no se realizaron búsquedas web.",
                "from_cache": False,
            }

        cache_key = self._cache_key(query=query, provider=selected_provider)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return {
                "mode": "online",
                "provider": selected_provider,
                "results": cached,
                "summary": "Resultados recuperados de caché.",
                "from_cache": True,
            }

        if selected_provider == "hackernews":
            raw_results = self._search_hackernews(query)
        else:
            raw_results = self._search_duckduckgo(query)

        curated: List[Dict] = []
        dedupe = set()
        for item in raw_results:
            url = item.get("url") or ""
            if not url or url in dedupe:
                continue
            dedupe.add(url)

            combined_text = f"{item.get('title', '')} {item.get('snippet', '')}"
            item["rumor_flag"] = self._is_rumor_like(combined_text)
            item["is_trusted_source"] = self._is_trusted_domain(item.get("domain", ""))
            item["score"] = self._score_result(item)
            curated.append(item)

        curated.sort(key=lambda entry: entry.get("score", 0.0), reverse=True)
        max_results = max(1, int(settings.WEB_SEARCH_MAX_RESULTS))

        if settings.WEB_SEARCH_REQUIRE_TRUSTED_SOURCES:
            trusted = [item for item in curated if item.get("is_trusted_source")]
            minimum = max(1, int(settings.WEB_SEARCH_MIN_TRUSTED_SOURCES))
            if len(trusted) >= minimum:
                curated = trusted

        curated = curated[:max_results]
        self._set_cached(cache_key=cache_key, query=query, provider=selected_provider, results=curated)
        return {
            "mode": "online",
            "provider": selected_provider,
            "results": curated,
            "summary": f"Resultados obtenidos con proveedor {selected_provider}.",
            "from_cache": False,
        }

    @staticmethod
    def build_cited_response(query: str, results: List[Dict], provider: str, from_cache: bool) -> str:
        if not results:
            return (
                "No he encontrado suficientes fuentes confiables para responder de forma segura.\n"
                "Intenta con una consulta más específica o verifica manualmente en fuentes oficiales."
            )

        lines = [
            f"Resultados web para: {query}",
            f"Proveedor: {provider}" + (" (cache)" if from_cache else ""),
            "",
            "Fuentes verificadas:",
        ]
        for idx, item in enumerate(results, start=1):
            date_value = item.get("published_at") or item.get("fetched_at") or "fecha no disponible"
            lines.append(
                f"[{idx}] {item.get('title', 'Sin título')} "
                f"(Fuente: {item.get('domain', 'desconocida')}, Fecha: {date_value})"
            )
            if item.get("snippet"):
                lines.append(f"    - {item['snippet'][:260]}")
            lines.append(f"    - URL: {item.get('url')}")

        lines.extend(
            [
                "",
                "Nota anti-rumor: se priorizaron dominios confiables y se penalizaron resultados con señales de rumor.",
            ]
        )
        return "\n".join(lines)
