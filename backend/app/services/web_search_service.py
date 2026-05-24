import hashlib
import html
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

from pymongo import MongoClient

from app.config import settings


class WebSearchService:
    def __init__(self):
        self.mongo = MongoClient(settings.MONGODB_URL)
        self.db = self.mongo[settings.DATABASE_NAME]
        self.cache = self.db["web_search_cache"]
        self.articles = self.db["articles"]

    @staticmethod
    def _http_text(url: str, timeout: int = 15) -> str:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 deepLit-web-researcher/1.0"})
        with urlopen(req, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="replace")

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            return (urlparse(url).netloc or "").lower().replace("www.", "")
        except Exception:
            return ""

    @staticmethod
    def _cache_key(query: str, provider: str) -> str:
        raw = f"{provider}|{query.strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _get_cached(self, cache_key: str) -> Optional[List[Dict]]:
        cached = self.cache.find_one(
            {"cache_key": cache_key, "expires_at": {"$gt": datetime.now(timezone.utc)}}
        )
        return cached.get("results") if cached else None

    def _set_cached(self, cache_key: str, query: str, provider: str, results: List[Dict]) -> None:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=max(1, int(settings.WEB_SEARCH_CACHE_TTL_MINUTES)))
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

    def get_collection_context(self, user_id: Optional[str], collection_id: Optional[str], limit: int = 8) -> str:
        if not user_id:
            return "Usuario no autenticado."

        filter_query = {
            "id_user": user_id,
            "status": {"$nin": ["processing", "error"]},
        }
        if collection_id:
            filter_query["collection_ids"] = {"$in": [collection_id]}

        projection = {"title": 1, "authors": 1, "keywords": 1, "year": 1}
        articles = list(self.articles.find(filter_query, projection).limit(limit))
        if not articles:
            return "No hay articulos disponibles en la coleccion activa."

        lines = []
        for article in articles:
            title = str(article.get("title") or "Sin titulo").strip()
            authors = ", ".join(article.get("authors") or []) or "Sin autores"
            year = article.get("year") or "s/f"
            keywords = []
            for item in article.get("keywords") or []:
                if isinstance(item, dict):
                    value = item.get("key") or item.get("display_name") or item.get("name")
                else:
                    value = item
                text = str(value or "").strip()
                if text:
                    keywords.append(text)
            keywords_text = ", ".join(keywords[:3]) or "Sin keywords"
            lines.append(f'- "{title}" | {authors} | {year} | {keywords_text}')
        return "\n".join(lines)

    @staticmethod
    def _decode_duckduckgo_url(raw_url: str) -> str:
        if not raw_url:
            return ""
        cleaned = html.unescape(raw_url).replace("&amp;", "&")
        if cleaned.startswith("//"):
            cleaned = f"https:{cleaned}"
        params = parse_qs(urlparse(cleaned).query or "")
        if "uddg" in params and params["uddg"]:
            return params["uddg"][0]
        return cleaned

    @classmethod
    def _parse_duckduckgo_html(cls, page_html: str) -> List[Dict]:
        results = []
        seen = set()
        link_pattern = re.compile(r'(?s)<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>')
        snippet_pattern = re.compile(
            r'(?s)<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</div>'
        )

        for link_match in link_pattern.finditer(page_html):
            url = cls._decode_duckduckgo_url(link_match.group(1))
            title = html.unescape(re.sub(r"<.*?>", "", link_match.group(2))).strip()
            if not url or not title or url in seen:
                continue
            seen.add(url)

            nearby_html = page_html[link_match.end(): link_match.end() + 800]
            snippet_match = snippet_pattern.search(nearby_html)
            snippet_html = ""
            if snippet_match:
                snippet_html = snippet_match.group(1) or snippet_match.group(2) or ""
            snippet = html.unescape(re.sub(r"<.*?>", "", snippet_html)).strip()

            results.append(
                {
                    "title": title,
                    "url": url,
                    "domain": cls._extract_domain(url),
                    "snippet": snippet,
                    "published_at": None,
                    "fetched_at": datetime.now(timezone.utc).date().isoformat(),
                }
            )

        return results

    def _search_duckduckgo(self, query: str) -> List[Dict]:
        url = "https://html.duckduckgo.com/html/?" + urlencode({"q": query})
        return self._parse_duckduckgo_html(self._http_text(url))

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

        selected_provider = (provider or "duckduckgo").strip().lower()
        if selected_provider != "duckduckgo":
            selected_provider = "duckduckgo"

        if offline:
            return {
                "mode": "offline",
                "provider": selected_provider,
                "results": [],
                "from_cache": False,
            }

        cache_key = self._cache_key(query, selected_provider)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return {
                "mode": "online",
                "provider": selected_provider,
                "results": cached,
                "from_cache": True,
            }

        results = self._search_duckduckgo(query)[: max(1, int(settings.WEB_SEARCH_MAX_RESULTS))]
        self._set_cached(cache_key, query, selected_provider, results)
        return {
            "mode": "online",
            "provider": selected_provider,
            "results": results,
            "from_cache": False,
        }

    @staticmethod
    def build_cited_response(
        user_query: str,
        effective_query: str,
        results: List[Dict],
        provider: str,
        from_cache: bool,
    ) -> str:
        if not results:
            return "No encontre resultados web utiles para esa busqueda. Prueba con mas contexto o con el titulo del articulo."

        lines = ["He encontrado estos resultados:"]
        if effective_query.strip() and effective_query.strip() != user_query.strip():
            lines.append(f"Busqueda: {effective_query}")
        if from_cache:
            lines.append("Resultados recuperados de cache.")
        lines.append("")

        for idx, item in enumerate(results, start=1):
            lines.append(f"{idx}. {item.get('title', 'Sin titulo')}")
            if item.get("snippet"):
                lines.append(f"    - {item['snippet'][:240]}")
            if item.get("url"):
                lines.append(f"    - Enlace: {item['url']}")

        return "\n".join(lines)
