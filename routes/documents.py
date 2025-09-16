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
        except InvalidId:
            flash("Documento no encontrado")
    if result is None:
        result = redirect(url_for('documents.home'))
    return result


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

