# utils.py
import re
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from wordcloud import WordCloud

def extract_text_from_pdf(pdf_path):
    """Extrae el texto completo de un archivo PDF."""
    full_text = ""
    with open(pdf_path, 'rb') as file:
        import PyPDF2
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
    return full_text

def extract_title(text):
    """Extrae el título del documento (se asume que es la primera línea significativa)."""
    for line in text.splitlines():
        cleaned = line.strip()
        if cleaned and len(cleaned) > 5:
            return cleaned
    return "No se encontró el título."

def extract_abstract(text):
    pattern = r'(Abstract\s*[:.-]*)(.*?)(?=\n\s*(Keywords|Palabras clave|Introduction|Introducción))'
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    return match.group(2).strip() if match else "No se encontró el abstract."

def extract_keywords(text):
    pattern = r'(Keywords|Palabras clave)\s*[:.-]*\s*(.*?)(?=\n)'
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(2).strip() if match else "No se encontraron keywords."

def extract_bibliography(text):
    pattern = r'(^|\n)\s*(References|Bibliography|eferences)\s*[:.-]*\s*(.*)'
    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL)
    if match:
        biblio_text = match.group(3).strip()
        end_pattern = r'(?:\n\s*(?:Appendix|Anexo|Apendices|Supplementary|Suplementario)|received the)'
        end_match = re.search(end_pattern, biblio_text, re.IGNORECASE)
        if end_match:
            biblio_text = biblio_text[:end_match.start()].strip()
        return biblio_text
    return "No se encontró la bibliografía."

def extract_citations(text):
    pattern = re.compile(r'\[(\d+)\](.*?)(?=\[\d+\]|$)', re.DOTALL)
    citations = []
    for match in pattern.finditer(text):
        number = match.group(1)
        content = match.group(2)
        cleaned = ' '.join(content.split())
        citation_entry = f"[{number}] {cleaned}"
        citations.append(citation_entry)
    return citations

# Funciones para campos adicionales
def extract_anio(text):
    pattern = r"Año\s*[:\-]\s*(\d{4})"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1) if match else ""

def extract_categoria(text):
    pattern = r"Categor[ií]a\s*[:\-]\s*(.+)"
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).split("\n")[0].strip()
    return ""

def extract_tipo(text):
    pattern = r"Tipo\s*[:\-]\s*(.+)"
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).split("\n")[0].strip()
    return ""

def extract_acronimo(text):
    pattern = r"Acr[oó]nimo\s*[:\-]\s*(\w+)"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else ""

def extract_paginas(text):
    pattern = r"Pág\.?\s*[:\-]?\s*(\d+)"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else ""

def extract_obs(text):
    pattern = r"Obs\s*[:\-]\s*(.+)"
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).split("\n")[0].strip()
    return ""

def extract_resumen(text):
    pattern = r"Resumen\s*[:\-]\s*(.+)"
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else ""

def extract_enlace(text):
    pattern = r"Enlace\s*[:\-]\s*(\S+)"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else ""

def extract_cita(text):
    pattern = r"Cita\s*[:\-]\s*(.+)"
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else ""

def generate_wordcloud():
    """
    Genera una wordcloud a partir de las keywords de todos los documentos en la base de datos.
    Devuelve la imagen codificada en base64 para incrustarla en la web.
    """
    from extensions import mongo  # Importamos mongo desde el módulo de extensiones
    docs = mongo.db.documents.find()
    text = ""
    for doc in docs:
        if "keywords" in doc:
            text += " " + doc["keywords"]
    if not text.strip():
        text = "No keywords"
    wc = WordCloud(width=800, height=200, background_color="white").generate(text)
    plt.figure(figsize=(8, 2))
    plt.imshow(wc, interpolation="bilinear")
    plt.axis("off")
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    plt.close()  # Liberar memoria
    buf.seek(0)
    img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return img_base64

