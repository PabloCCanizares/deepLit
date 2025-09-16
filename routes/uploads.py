# routes/uploads.py
from flask import Blueprint, render_template, request, redirect, url_for, flash
from bson.objectid import ObjectId
from extensions import mongo
from utils import (
    extract_text_from_pdf, extract_title, extract_abstract,
    extract_keywords, extract_bibliography, extract_citations,
    extract_anio, extract_categoria, extract_tipo, extract_acronimo,
    extract_paginas, extract_obs, extract_resumen, extract_enlace, extract_cita
)
import os

uploads_bp = Blueprint('uploads', __name__, template_folder='../templates')

@uploads_bp.route('/upload_pdf_page')
def upload_pdf_page():
    """Página para subir un PDF."""
    return render_template('upload.html')

@uploads_bp.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    if 'pdf' not in request.files:
        flash("No se encontró el archivo PDF.")
        return redirect(url_for('documents.upload_pdf_page'))
    
    file = request.files['pdf']
    if file.filename == '':
        flash("No se seleccionó ningún archivo.")
        return redirect(url_for('documents.upload_pdf_page'))
    
    autores = request.form.get('autores', '').strip()

    temp_folder = os.path.join("temp")
    os.makedirs(temp_folder, exist_ok=True)
    temp_path = os.path.join(temp_folder, file.filename)
    file.save(temp_path)
    
    text = extract_text_from_pdf(temp_path)
    title = extract_title(text)
    abstract = extract_abstract(text)
    keywords = extract_keywords(text)
    bibliography = extract_bibliography(text)
    citations = extract_citations(bibliography)
    
    anio = extract_anio(text)
    categoria = extract_categoria(text)
    tipo = extract_tipo(text)
    acronimo = extract_acronimo(text)
    paginas = extract_paginas(text)
    obs = extract_obs(text)
    resumen = extract_resumen(text)
    enlace = extract_enlace(text)
    cita = extract_cita(text)
    
    doc = {
        "filename": file.filename,
        "title": title,
        "abstract": abstract,
        "keywords": keywords,
        "bibliography": bibliography,
        "citations": citations,
        "autores": autores,
        "Year": anio,             # Usamos "Year" para mantener la consistencia con home.html
        "Category": categoria,
        "Type": tipo,
        "Acronym": acronimo,
        "Cites": "",              # Ajusta según necesites
        "Pag.": paginas,
        "Obs.": obs,
        "Summary": resumen,
        "link": enlace,
        "citation": cita
    }
    mongo.db.documents.insert_one(doc)
    os.remove(temp_path)
    
    return render_template('result.html', document=doc)

@uploads_bp.route('/upload_folder', methods=['GET', 'POST'])
def upload_folder():
    if request.method == 'POST':
        files = request.files.getlist('pdfs')
        if not files or len(files) == 0:
            flash("No se seleccionaron archivos.")
            return redirect(url_for('documents.upload_folder'))
        
        processed_docs = []
        temp_folder = os.path.join("temp")
        os.makedirs(temp_folder, exist_ok=True)
        
        for file in files:
            if file.filename == '' or not file.filename.lower().endswith('.pdf'):
                continue
            temp_path = os.path.join(temp_folder, file.filename)
            file.save(temp_path)
            
            text = extract_text_from_pdf(temp_path)
            title = extract_title(text)
            abstract = extract_abstract(text)
            keywords = extract_keywords(text)
            bibliography = extract_bibliography(text)
            citations = extract_citations(bibliography)
            
            anio = extract_anio(text)
            categoria = extract_categoria(text)
            tipo = extract_tipo(text)
            acronimo = extract_acronimo(text)
            paginas = extract_paginas(text)
            obs = extract_obs(text)
            resumen = extract_resumen(text)
            enlace = extract_enlace(text)
            cita = extract_cita(text)
            
            doc = {
                "filename": file.filename,
                "title": title,
                "abstract": abstract,
                "keywords": keywords,
                "bibliography": bibliography,
                "citations": citations,
                "Year": anio,
                "Category": categoria,
                "Type": tipo,
                "Acronym": acronimo,
                "Cites": "",
                "Pag.": paginas,
                "Obs.": obs,
                "Summary": resumen,
                "link": enlace,
                "citation": cita
            }
            mongo.db.documents.insert_one(doc)
            processed_docs.append(doc)
            os.remove(temp_path)
        
        flash(f"Se han subido {len(processed_docs)} documentos.")
        return render_template('result_folder.html', documents=processed_docs)
    
    return render_template('upload_folder.html')

@uploads_bp.route('/upload_excel', methods=['GET', 'POST'])
def upload_excel():
    if request.method == 'POST':
        if 'excel' not in request.files:
            flash("No se encontró el archivo Excel.")
            return redirect(url_for('documents.upload_excel'))
        
        file = request.files['excel']
        if file.filename == '':
            flash("No se seleccionó ningún archivo Excel.")
            return redirect(url_for('documents.upload_excel'))
        
        temp_folder = os.path.join("temp")
        os.makedirs(temp_folder, exist_ok=True)
        temp_path = os.path.join(temp_folder, file.filename)
        file.save(temp_path)
        
        processed_docs = []
        try:
            from openpyxl import load_workbook
            wb = load_workbook(temp_path)
            sheet = wb.active
            
            required_columns = [
                "Year", "Title", "Category", "Type", "Acronym", "Cites",
                "Pag.", "Obs.", "Summary", "link", "citation", "abstract"
            ]
            
            headers = [cell.value for cell in sheet[1]]
            for col_name in required_columns:
                if col_name not in headers:
                    flash(f"No se encontró la columna requerida: {col_name}.")
                    return redirect(url_for('documents.upload_excel'))
            
            col_index_map = { col_name: headers.index(col_name) + 1 for col_name in required_columns }
            
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not any(row):
                    continue
                doc = {}
                for col_name in required_columns:
                    idx = col_index_map[col_name] - 1
                    valor = row[idx] if idx < len(row) else None
                    doc[col_name] = valor if valor is not None else ""
                mongo.db.documents.insert_one(doc)
                processed_docs.append(doc)
            
            flash(f"Se han subido {len(processed_docs)} documentos desde el Excel.")
        except Exception as e:
            flash(f"Ocurrió un error procesando el Excel: {str(e)}")
        finally:
            os.remove(temp_path)
        
        return render_template('result_excel.html', documents=processed_docs)
    
    return render_template('upload_excel.html')