
"""

# routes/documents.py
from flask import Blueprint, render_template, request, redirect, url_for, flash
from bson.objectid import ObjectId
from extensions import mongo
from utils import (extract_text_from_pdf, extract_title, extract_abstract,
                   extract_keywords, extract_bibliography, extract_citations,
                   extract_anio, extract_categoria, extract_tipo, extract_acronimo,
                   extract_paginas, extract_obs, extract_resumen, extract_enlace, extract_cita,
                   generate_wordcloud)
import os

documents_bp = Blueprint('documents', __name__, template_folder='../templates')

@documents_bp.route('/home')
def home():
    # Carga la configuración
    config = mongo.db.configuration.find_one({"_id": "settings"})
    if not config:
        config = {
            "_id": "settings",
            "required_fields": ["Year", "Title", "Category", "Type", "Acronym", "Cites", "Pag.", "Obs.", "Summary", "link", "citation", "abstract"],
            "order_by_year": "asc"
        }
        mongo.db.configuration.insert_one(config)
    elif "order_by_year" not in config:
        config["order_by_year"] = "asc"
        mongo.db.configuration.update_one({"_id": "settings"}, {"$set": {"order_by_year": "asc"}}, upsert=True)
    
    documents_cursor = mongo.db.documents.find()
    documents = []
    for doc in documents_cursor:
        doc["_id"] = str(doc["_id"])
        documents.append(doc)
    
    def is_valid_year(val):
        try:
            int(val)
            return True
        except (ValueError, TypeError):
            return False
    
    valid_docs = [d for d in documents if is_valid_year(d.get("Year"))]
    invalid_docs = [d for d in documents if not is_valid_year(d.get("Year"))]
    
    if config.get("order_by_year") == "desc":
        valid_docs = sorted(valid_docs, key=lambda d: int(d.get("Year")), reverse=True)
    else:
        valid_docs = sorted(valid_docs, key=lambda d: int(d.get("Year")))
    
    sorted_docs = valid_docs + invalid_docs
    
    return render_template('home.html', documents=sorted_docs, config=config)

@documents_bp.route('/result/<id>')
def result(id):
    result = None
    if not ObjectId.is_valid(id):
        flash("Documento no encontrado")
    else:
        try:
            doc = mongo.db.documents.find_one({"_id": ObjectId(id)})
            if doc:
                oid = doc["_id"] if isinstance(doc["_id"], ObjectId) else ObjectId(doc["_id"])
                doc["upload_date"] = oid.generation_time.strftime("%Y-%m-%d %H:%M:%S")
                doc["_id"] = str(doc["_id"])
                result = render_template('result.html', document=doc)
            else:
                flash("Documento no encontrado")
        except InvalidId: #FIXME IndexError ? 
            flash("Documento no encontrado")
    if result is None:
        result = redirect(url_for('documents.home'))
    return result
"""









# routes/documents.py
from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from bson.errors import InvalidId
from bson.objectid import ObjectId
from extensions import mongo
from utils import (extract_text_from_pdf, extract_title, extract_abstract,
                   extract_keywords, extract_bibliography, extract_citations,
                   extract_anio, extract_categoria, extract_tipo, extract_acronimo,
                   extract_paginas, extract_obs, extract_resumen, extract_enlace, extract_cita,
                   generate_wordcloud)
#FIXME esto no se usa , se deberia de quitar

import os

documents_bp = Blueprint('documents', __name__, template_folder='../templates')


@documents_bp.route('/documents')
@documents_bp.route('/home')
def home():

    # Carga la configuración
    config = mongo.db.configuration.find_one({"_id": "settings"})
    if not config:
        config = {
            "_id": "settings",
            "required_fields": ["Year", "Title", "Category", "Type", "Acronym", "Cites", "Pag", "Obs", "Summary", "link", "citation", "abstract"],
            "order_by_year": "asc"
        }
        mongo.db.configuration.insert_one(config)
    elif "order_by_year" not in config:
        config["order_by_year"] = "asc"
        mongo.db.configuration.update_one({"_id": "settings"}, {"$set": {"order_by_year": "asc"}}, upsert=True)
    
    documents_cursor = mongo.db.documents.find()
    documents = []
    for doc in documents_cursor:
        doc["_id"] = str(doc["_id"])
        documents.append(doc)
    
    def is_valid_year(val):
        try:
            int(val)
            return True
        except (ValueError, TypeError):
            return False
    
    valid_docs = [d for d in documents if is_valid_year(d.get("Year"))]
    invalid_docs = [d for d in documents if not is_valid_year(d.get("Year"))]
    
    if config.get("order_by_year") == "desc":
        valid_docs = sorted(valid_docs, key=lambda d: int(d.get("Year")), reverse=True)
    else:
        valid_docs = sorted(valid_docs, key=lambda d: int(d.get("Year")))
    
    sorted_docs = valid_docs + invalid_docs
    
    return render_template('documents.html', documents=sorted_docs, config=config)


@documents_bp.route('/visualizar/<id>')
def watch_document(id):
    """Vista de solo lectura del documento (watch_document.html).
    Valida el ObjectId y la existencia del documento, igual que en edición.
    """
    if not ObjectId.is_valid(id):
        flash("Documento no encontrado")
        return redirect(url_for('documents.home'))

    doc = mongo.db.documents.find_one({"_id": ObjectId(id)})
    if not doc:
        flash("Documento no encontrado")
        return redirect(url_for('documents.home'))

    # Normalizar id y fecha
    oid = doc.get("_id")
    if oid is not None:
        try:
            doc["_id"] = str(oid)
            doc["upload_date"] = oid.generation_time.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                doc["_id"] = str(oid)
            except Exception:
                pass

    return render_template('watch_document.html', document=doc)


@documents_bp.route('/edit/<id>', methods=['GET', 'POST'])
def edit_document(id):
    """Pantalla de edición moderna para PDF/Excel.
    Si viene en modo lote (batch), muestra botón 'Siguiente documento'.
    """
    if not ObjectId.is_valid(id):
        flash("Documento no encontrado")
        return redirect(url_for('documents.home'))

    if request.method == 'POST':
        # Recoger todos los campos posibles (usar claves de Excel como estándar)
        fields = [
            "Year", "Title", "Category", "Type", "Acronym", "Cites",
            "Pag", "Obs", "Summary", "link", "citation", "abstract", "autores", "filename"
        ]
        payload = {}
        for f in fields:
            val = request.form.get(f, None)
            if val is not None:
                payload[f] = val

        # Normalizar título: mantener sincronizados 'Title' (canónico) y 'title' (compat)
        try:
            t_cap = (payload.get('Title') or '').strip()
            t_low = (payload.get('title') or '').strip()
            if t_cap:
                payload['Title'] = t_cap
                payload['title'] = t_cap
            elif t_low:
                payload['Title'] = t_low
                payload['title'] = t_low
        except Exception:
            pass
        try:
            mongo.db.documents.update_one({"_id": ObjectId(id)}, {"$set": payload})
        except Exception as e:
            flash(f"Error guardando: {str(e)}")

        # Navegación por lote
        in_batch = request.form.get('batch', request.args.get('batch', '0')) == '1'
        go_next = request.form.get('next', '0') == '1'
        try:
            idx = int(request.form.get('index', request.args.get('index', '0')))
        except Exception:
            idx = 0
        batch_ids = session.get('batch_ids', [])
        if in_batch and batch_ids and go_next:
            next_idx = idx + 1
            if next_idx < len(batch_ids):
                next_id = batch_ids[next_idx]
                return redirect(url_for('documents.edit_document', id=next_id, batch=1, index=next_idx))
            else:
                # Fin del lote
                try:
                    session.pop('batch_ids')
                except KeyError:
                    pass
                return redirect(url_for('documents.home'))

        # Redirigir a la URL de retorno si se proporcionó (y no es flujo de 'siguiente')
        ret = request.form.get('return', '').strip()
        try:
            from urllib.parse import urlparse
            host = urlparse(request.host_url)
            target = urlparse(ret)
            is_safe = target.scheme in ('http','https') and target.netloc == host.netloc
        except Exception:
            is_safe = False
        if ret and is_safe:
            return redirect(ret)
        # Fallback: volver a la lista de documentos actualizada
        return redirect(url_for('documents.home'))

    # GET
    doc = mongo.db.documents.find_one({"_id": ObjectId(id)})
    if not doc:
        flash("Documento no encontrado")
        return redirect(url_for('documents.home'))

    # Normalizar id y fecha
    oid = doc["_id"]
    doc["_id"] = str(oid)
    try:
        doc["upload_date"] = oid.generation_time.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass

    # Contexto de lote
    in_batch = request.args.get('batch', '0') == '1'
    try:
        idx = int(request.args.get('index', '0'))
    except Exception:
        idx = 0
    batch_ids = session.get('batch_ids', [])
    is_last = in_batch and (idx >= len(batch_ids) - 1)

    return render_template('complete_document.html', document=doc, batch=in_batch, index=idx, is_last=is_last)


@documents_bp.route('/search', methods=['GET', 'POST'])
def search():
    if request.method == 'POST':
        query = request.form.get('query', '')
        if query:
            results_cursor = mongo.db.documents.find({"title": {"$regex": query, "$options": "i"}})
            results = []
            for doc in results_cursor:
                doc["_id"] = str(doc["_id"])
                results.append(doc)
        else:
            results = []
        return render_template('home.html', documents=results, query=query)
    return render_template('home.html', documents=None)

@documents_bp.route('/delete_all', methods=['POST'])
def delete_all():
    mongo.db.documents.delete_many({})
    flash("Se han borrado todas las entradas.")
    return redirect(url_for('dashboard.dashboard'))