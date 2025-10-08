from flask import Blueprint, jsonify, request, render_template
from extensions import mongo
import threading
import time
import requests
import difflib
from bson import ObjectId

completion_bp = Blueprint('completion_queue', __name__)
queue_processing = False  # Bandera de control

def calculate_similarity(a, b):
    """Calcula el índice de similitud entre dos cadenas usando difflib."""
    return difflib.SequenceMatcher(None, a, b).ratio()

def update_document_with_openalex(document, best_match):
    """
    Actualiza el documento principal con la mayor cantidad de campos posibles utilizando
    la información del best_match obtenido de OpenAlex.
    
    Se actualizan:
      - cites (citas)
      - doi
      - publication_date
      - journal (usando host_venue)
      - abstract
      - Pag. (páginas)
      - link (enlace al PDF)
      - Type (si es journal-article o conference-paper)
      - citation (BibTeX de la cita)
      - category (topics extraídos de "concepts" en OpenAlex)
    """
    update_data = {}
    # Actualiza citas (cites)
    if "cited_by_count" in best_match and not document.get("cites"):
        update_data["cites"] = best_match["cited_by_count"]
    # Actualiza DOI
    if "doi" in best_match and not document.get("doi"):
        update_data["doi"] = best_match["doi"]
    # Actualiza fecha de publicación
    if "publication_date" in best_match and not document.get("publication_date"):
        update_data["publication_date"] = best_match["publication_date"]
    # Actualiza el nombre de la revista (journal) usando host_venue
    if "host_venue" in best_match and not document.get("journal"):
        host = best_match["host_venue"]
        if isinstance(host, dict):
            update_data["journal"] = host.get("display_name") or host.get("name")
        else:
            update_data["journal"] = host
    # Actualiza el abstract
    if "abstract" in best_match and not document.get("abstract"):
        update_data["abstract"] = best_match["abstract"]
    # Actualiza las páginas. Se asume que en OpenAlex puede venir en "pages" o "page"
    if "pages" in best_match and not document.get("Pag."):
        update_data["Pag."] = best_match["pages"]
    elif "page" in best_match and not document.get("Pag."):
        update_data["Pag."] = best_match["page"]
    # Actualiza el enlace al PDF, usando "link" de OpenAlex
    if "link" in best_match and not document.get("link"):
        update_data["link"] = best_match["link"]
    # Actualiza el campo "Type" si no existe y si el tipo es "journal-article" o "conference-paper"
    if "type" in best_match and not document.get("Type"):
        t = best_match["type"]
        if t in ["journal-article", "conference-paper"]:
            update_data["Type"] = t
    # Actualiza "citation" si existe en best_match y el documento no lo tiene
    if "citation" in best_match and not document.get("citation"):
        update_data["citation"] = best_match["citation"]
    # Actualiza "category" utilizando los topics de OpenAlex (suponiendo que vienen en "concepts")
    if "concepts" in best_match and not document.get("category"):
        topics = [concept.get("display_name") for concept in best_match["concepts"] if concept.get("display_name")]
        if topics:
            update_data["category"] = topics
    if update_data:
        result = mongo.db.documents.update_one(
            {"_id": document["_id"]},
            {"$set": update_data}
        )
        print(f"[DEBUG] update_document_with_openalex updated {update_data}. Matched: {result.matched_count}, Modified: {result.modified_count}")

@completion_bp.route('/queue', methods=['GET'])
def queue_page():
    """Renderiza la página principal de la cola."""
    pending = list(mongo.db.completion_queue.find({"status": "pending"}))
    processing = list(mongo.db.completion_queue.find({"status": "processing"}))
    completed = list(mongo.db.completion_queue.find({"status": "completed"}))
    return render_template('queue.html', 
                           pending=len(pending),
                           processing=len(processing),
                           completed=len(completed))

@completion_bp.route('/queue/analyze', methods=['GET'])
def analyze_documents():
    """Analiza los documentos y devuelve los incompletos sin agregarlos a la cola."""
    config = mongo.db.configuration.find_one()
    if not config:
        return jsonify({"error": "No configuration found in the database. Please set required fields in /config"}), 400
    required_fields = config.get("required_fields", [])
    if not required_fields:
        return jsonify({"error": "No required fields found in config"}), 400
    incomplete_docs = []
    all_docs = mongo.db.documents.find({})
    for doc in all_docs:
        missing_fields = [field for field in required_fields if field not in doc or not doc[field]]
        if missing_fields:
            incomplete_docs.append({
                "document_id": str(doc["_id"]),
                "title": doc.get("title", "Sin título"),
                "missing_fields": missing_fields
            })
    return jsonify({"incomplete_documents": incomplete_docs})

@completion_bp.route('/queue/add', methods=['POST'])
def add_to_queue():
    """Agrega un documento a la cola."""
    data = request.json
    document_id = data.get('document_id')
    if not document_id:
        return jsonify({"error": "document_id is required"}), 400
    mongo.db.completion_queue.insert_one({
        "document_id": document_id,
        "status": "pending",
        "metadata": {},
        "created_at": time.time(),
        "updated_at": time.time()
    })
    return jsonify({"message": "Document added to queue"}), 200

@completion_bp.route('/queue/add_multiple', methods=['POST'])
def add_multiple_to_queue():
    """Añade múltiples documentos seleccionados a la cola, procesando incluso los que ya existen."""
    data = request.json
    document_ids = data.get("document_ids", [])
    if not document_ids:
        return jsonify({"error": "No documents selected"}), 400

    added_count = 0
    already_in_queue = 0
    for doc_id in document_ids:
        existing = mongo.db.completion_queue.find_one({"document_id": doc_id})
        if not existing:
            mongo.db.completion_queue.insert_one({
                "document_id": doc_id,
                "status": "pending",
                "metadata": {},
                "created_at": time.time(),
                "updated_at": time.time()
            })
            added_count += 1
        else:
            already_in_queue += 1

    message = f"{added_count} documents added to queue, {already_in_queue} were already in queue"
    return jsonify({"message": message}), 200


@completion_bp.route('/queue/status', methods=['GET'])
def queue_status():
    """Muestra el estado actual de la cola, incluyendo la metadata de matching en los completados."""
    pending = list(mongo.db.completion_queue.find({"status": "pending"}))
    processing = list(mongo.db.completion_queue.find({"status": "processing"}))
    completed = list(mongo.db.completion_queue.find({"status": "completed"}))
    completed_docs = []
    for doc in completed:
        completed_docs.append({
            "document_id": doc.get("document_id", ""),
            "metadata": doc.get("metadata", {})
        })
    return jsonify({
        "pending": len(pending),
        "processing": len(processing),
        "completed": len(completed),
        "completed_docs": completed_docs,
        "queue_processing": queue_processing
    })

@completion_bp.route('/queue/pending', methods=['GET'])
def pending_docs():
    """Retorna la lista de documentos pendientes en la cola con información enriquecida."""
    config = mongo.db.configuration.find_one() or {}
    required_fields = config.get("required_fields", [])
    pending = list(mongo.db.completion_queue.find({"status": {"$in": ["pending", "processing"]}}))
    pending_docs = []
    for doc in pending:
        try:
            document = mongo.db.documents.find_one({"_id": ObjectId(doc["document_id"])})
        except Exception as e:
            document = None
        if document:
            title = document.get("title", "Documento sin título")
            missing_fields = [field for field in required_fields if field not in document or not document[field]]
        else:
            title = "Documento no encontrado"
            missing_fields = []
        pending_docs.append({
            "document_id": doc.get("document_id", ""),
            "title": title,
            "missing_fields": missing_fields
        })
    return jsonify({"pending_docs": pending_docs})

@completion_bp.route('/queue/start', methods=['POST'])
def start_queue():
    """Inicia el procesamiento de la cola."""
    global queue_processing
    if queue_processing:
        return jsonify({"message": "Queue is already running"}), 400
    queue_processing = True
    thread = threading.Thread(target=process_queue, daemon=True)
    thread.start()
    return jsonify({"message": "Queue started"}), 200

@completion_bp.route('/queue/stop', methods=['POST'])
def stop_queue():
    """Detiene el procesamiento de la cola."""
    global queue_processing
    queue_processing = False
    return jsonify({"message": "Queue stopped"}), 200

@completion_bp.route('/queue/intermediate', methods=['GET'])
def matching_view():
    """
    Vista intermedia para visualizar el matching de documentos completados y
    los cambios realizados en el documento tras el matching.
    Se obtiene la lista de documentos completados y se añade el documento actualizado.
    """
    completed_docs = list(mongo.db.completion_queue.find({"status": "completed"}))
    for doc in completed_docs:
        try:
            original_doc = mongo.db.documents.find_one({"_id": ObjectId(doc["document_id"])})
            doc["updated_document"] = original_doc
        except Exception as e:
            doc["updated_document"] = None
    return render_template('queue_intermediate.html', completed_docs=completed_docs)

def fetch_from_openalex(query):
    """Realiza una búsqueda en OpenAlex usando el título del documento con depuración."""
    url = f"https://api.openalex.org/works?search={query}"
    print(f"[DEBUG] OpenAlex: Querying URL: {url}")
    try:
        response = requests.get(url)
    except Exception as e:
        print(f"[DEBUG] OpenAlex: Request error: {e}")
        return []
    if response.status_code == 200:
        data = response.json()
        results = data.get("results", [])
        print(f"[DEBUG] OpenAlex: {len(results)} results for '{query}'")
        if results:
            print(f"[DEBUG] OpenAlex: First result: {results[0]}")
        return results
    else:
        print(f"[DEBUG] OpenAlex: Error {response.status_code}: {response.text}")
        return []

def process_queue():
    """Procesa los documentos en la cola, obtiene el mejor match desde OpenAlex y actualiza tanto la cola como el documento principal."""
    global queue_processing
    while queue_processing:
        doc = mongo.db.completion_queue.find_one({"status": "pending"})
        if not doc:
            time.sleep(5)
            continue
        mongo.db.completion_queue.update_one(
            {"_id": doc["_id"]},
            {"$set": {"status": "processing"}}
        )
        try:
            document = mongo.db.documents.find_one({"_id": ObjectId(doc["document_id"])})
        except Exception as e:
            print(f"[DEBUG] Error processing document_id {doc['document_id']}: {e}")
            document = None
        if not document:
            mongo.db.completion_queue.update_one(
                {"_id": doc["_id"]},
                {"$set": {"status": "completed", "metadata": {"error": "Document not found"}}}
            )
            continue
        title = document.get("title", "").strip()
        if not title:
            title = "Sin título (campo 'title' not found)"
        print(f"[DEBUG] Processing: '{title}'")
        results = fetch_from_openalex(title)
        best_match = {}
        best_score = 0
        for res in results:
            res_title = res.get("display_name", "")
            score = calculate_similarity(title.lower(), res_title.lower())
            print(f"[DEBUG] Comparing '{title}' vs '{res_title}': score = {score:.2f}")
            if score > best_score:
                best_score = score
                best_match = res
        print(f"[DEBUG] Best match for '{title}': {best_match.get('display_name', 'None')} with score {best_score:.2f}")
        result = mongo.db.completion_queue.update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "status": "completed",
                "metadata": {
                    "title": title,
                    "match": best_match,
                    "match_score": best_score
                }
            }}
        )
        print(f"[DEBUG] Queue update: matched={result.matched_count}, modified={result.modified_count}")
        mongo.db.documents.update_one(
            {"_id": ObjectId(doc["document_id"])},
            {"$set": {
                "openalex_match": best_match,
                "openalex_match_score": best_score,
                "openalex_title": title
            }}
        )
        update_document_with_openalex(document, best_match)
        time.sleep(2)
