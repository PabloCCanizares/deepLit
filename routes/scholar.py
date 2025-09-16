# routes/scholar.py
from flask import Blueprint, render_template
import requests
from scholarly import scholarly

scholar_bp = Blueprint('scholar', __name__, template_folder='templates')

def search_google_scholar(query):
    print("search_google_scholar - init")
    search_results = scholarly.search_pubs(query)
    try:
        publication = next(search_results)
        print("GS publication ", publication)
        return {
            "title": publication['bib']['title'],
            "authors": publication['bib']['author'],
            "year": publication['bib'].get('year', 'Desconocido'),
            "venue": publication['bib'].get('venue', 'Desconocido'),
            "num_citations": publication.get('num_citations', 'Desconocido'),
            "abstract": publication['bib'].get('abstract', 'No disponible'),
            "pub_url": publication.get('pub_url', 'No disponible'),
        }
    except StopIteration:
        return None

def search_semantic_scholar(query):
    print("search_semantic_scholar - init")

    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={query}&fields=title,authors,year,venue,citationCount,abstract,url"
    response = requests.get(url)
    if response.status_code == 200:
        results = response.json().get('data', [])
        if results:
            paper = results[0]
            print("SS publication ", paper)

            return {
                "title": paper.get('title', 'Desconocido'),
                "authors": ", ".join([author['name'] for author in paper.get('authors', [])]),
                "year": paper.get('year', 'Desconocido'),
                "venue": paper.get('venue', 'Desconocido'),
                "num_citations": paper.get('citationCount', 'Desconocido'),
                "abstract": paper.get('abstract', 'No disponible'),
                "pub_url": paper.get('url', 'No disponible'),
                "pdf_url": paper.get('pdf_url', 'No disponible'),
            }
    return None

@scholar_bp.route("/scholar", methods=["GET"])
def scholar():
    print("Que pasa")
    query = "Testing the untestable"  # Puedes modificar para obtener de request.form si lo deseas
    data = {
        "scholarly": search_google_scholar(query),
        "semantic": search_semantic_scholar(query)
    }
    return render_template("scholar_results.html", data=data)

