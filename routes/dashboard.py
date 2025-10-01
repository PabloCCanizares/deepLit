# routes/dashboard.py
from flask import Blueprint, render_template
from bson.objectid import ObjectId
from extensions import mongo
from utils import generate_wordcloud

dashboard_bp = Blueprint('dashboard', __name__, template_folder='../templates')

def count_citations(value):
    """Devuelve un número de citas a partir de distintos tipos de campo."""
    if value is None:
        return 0
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, (list, tuple, set)):
        return len(value)
    if isinstance(value, dict):
        # si guardas un dict por cita, cuenta entradas; si usas 'count', respáldalo:
        return value.get('count', len(value))
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return 0
        # ¿es un número en texto?
        try:
            return max(0, int(s))
        except ValueError:
            # si es una lista separada por comas
            return len([p for p in s.split(',') if p.strip()])
    return 0

@dashboard_bp.route('/dashboard')
def dashboard():
    """Dashboard avanzado: estadísticas, diagrama de barras, wordcloud, etc."""
    docs = list(mongo.db.documents.find())
    total_documents = len(docs)

    # Citas totales y media robustas a tipos heterogéneos
    total_references = sum(count_citations(doc.get("citations")) for doc in docs)
    avg_references = round(total_references / total_documents, 2) if total_documents else 0

    # Diagrama de barras por año (robusto)
    year_counts = {}
    for doc in docs:
        year = doc.get("Year")
        if year is None or year == "":
            continue
        try:
            y = int(year)
            year_counts[y] = year_counts.get(y, 0) + 1
        except (ValueError, TypeError):
            continue
    sorted_years = sorted(year_counts.keys())
    chart_labels = [str(y) for y in sorted_years]
    chart_values = [year_counts[y] for y in sorted_years]

    # Ranking de keywords (acepta str "a,b,c" o lista ["a","b","c"])
    keyword_freq = {}
    for doc in docs:
        kw = doc.get("keywords")
        parts = []
        if isinstance(kw, str):
            if kw.strip() and kw.strip().lower() != "no se encontraron keywords":
                parts = [w.strip().lower() for w in kw.split(',')]
        elif isinstance(kw, (list, tuple, set)):
            parts = [str(w).strip().lower() for w in kw]
        for w in parts:
            if w:
                keyword_freq[w] = keyword_freq.get(w, 0) + 1
    sorted_keywords = sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)

    # Documentos recientes (manejo cuidadoso de _id)
    recent_docs = list(mongo.db.documents.find().sort("_id", -1).limit(5))
    for doc in recent_docs:
        raw_id = doc.get("_id")
        oid = None
        if isinstance(raw_id, ObjectId):
            oid = raw_id
        else:
            try:
                oid = ObjectId(str(raw_id))
            except Exception:
                oid = None
        doc["upload_date"] = oid.generation_time.strftime("%Y-%m-%d %H:%M:%S") if oid else ""
        doc["_id"] = str(raw_id)

    # Notificaciones
    notif_abstract = sum(1 for d in docs if str(d.get("abstract", "")).strip() == "No se encontró el abstract.")
    notif_keywords = sum(1 for d in docs if str(d.get("keywords", "")).strip() == "No se encontraron keywords.")

    # Generar wordcloud
    wordcloud_img = generate_wordcloud()

    return render_template(
        'dashboard.html',
        total_documents=total_documents,
        total_references=total_references,
        avg_references=avg_references,
        chart_labels=chart_labels,
        chart_values=chart_values,
        sorted_keywords=sorted_keywords,
        recent_docs=recent_docs,
        notif_abstract=notif_abstract,
        notif_keywords=notif_keywords,
        wordcloud_img=wordcloud_img
    )

