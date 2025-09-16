import io
import os
import unittest
import tempfile
import json
import mongomock
from bson import ObjectId
from openpyxl import Workbook

from app import app
from extensions import mongo

# --- Monkey-patching de funciones de utilidades para pruebas ---
# Esto permite simular la extracción de datos sin procesar realmente un PDF o Excel.
def fake_extract_text_from_pdf(path):
    return "Fake text. Title: Test Title. Abstract: Test abstract. Keywords: key1, key2. Bibliography: ref1, ref2."

def fake_extract_title(text):
    return "Test Title"

def fake_extract_abstract(text):
    return "Test abstract"

def fake_extract_keywords(text):
    return "key1, key2"

def fake_extract_bibliography(text):
    return "ref1, ref2"

def fake_extract_citations(biblio):
    return ["Citation 1", "Citation 2"]

def fake_extract_anio(text):
    return "2022"

def fake_extract_categoria(text):
    return "Test Category"

def fake_extract_tipo(text):
    return "Test Type"

def fake_extract_acronimo(text):
    return "TT"

def fake_extract_paginas(text):
    return "10"

def fake_extract_obs(text):
    return "Test obs"

def fake_extract_resumen(text):
    return "Test resumen"

def fake_extract_enlace(text):
    return "http://example.com"

def fake_extract_cita(text):
    return "Test citation"

def fake_generate_wordcloud():
    return "data:image/png;base64,fakeimage"

# Se aplica el monkey-patch en el módulo de uploads
import routes.uploads as uploads_mod
uploads_mod.extract_text_from_pdf = fake_extract_text_from_pdf
uploads_mod.extract_title = fake_extract_title
uploads_mod.extract_abstract = fake_extract_abstract
uploads_mod.extract_keywords = fake_extract_keywords
uploads_mod.extract_bibliography = fake_extract_bibliography
uploads_mod.extract_citations = fake_extract_citations
uploads_mod.extract_anio = fake_extract_anio
uploads_mod.extract_categoria = fake_extract_categoria
uploads_mod.extract_tipo = fake_extract_tipo
uploads_mod.extract_acronimo = fake_extract_acronimo
uploads_mod.extract_paginas = fake_extract_paginas
uploads_mod.extract_obs = fake_extract_obs
uploads_mod.extract_resumen = fake_extract_resumen
uploads_mod.extract_enlace = fake_extract_enlace
uploads_mod.extract_cita = fake_extract_cita

# Y en el módulo del dashboard
import routes.dashboard as dashboard_mod
dashboard_mod.generate_wordcloud = fake_generate_wordcloud

# --- Clase de tests ---
class FlaskAppTestCase(unittest.TestCase):
    def setUp(self):
        # Configuración básica de testing
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

        # Configurar mongomock para simular la base de datos
        self.mongo_client = mongomock.MongoClient()
        mongo.cx = self.mongo_client
        mongo.db = self.mongo_client.test_db

        # Insertar configuración inicial en la base de datos de prueba
        mongo.db.configuration.insert_one({
            "_id": "settings",
            "required_fields": ["Year", "Title", "Category", "Type", "Acronym", "Cites", "Pag.", "Obs.", "Summary", "link", "citation", "abstract"],
            "order_by_year": "asc"
        })

    def tearDown(self):
        self.app_context.pop()

    def test_dashboard(self):
        # Insertar algunos documentos de prueba
        for i in range(3):
            doc = {
                "citations": ["c1", "c2"],
                "Year": str(2020 + i),
                "keywords": "key1, key2",
                "abstract": "abstract",
                "bibliography": "bib",
                "_id": ObjectId()
            }
            mongo.db.documents.insert_one(doc)
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        # Verifica que se incluya el total de documentos y otros elementos del dashboard
        self.assertIn(b"Panel de Control", response.data)

    def test_home(self):
        # Insertar documentos con año válido e inválido
        valid_doc = {"Year": "2022", "Title": "Valid Doc"}
        invalid_doc = {"Year": "not a year", "Title": "Invalid Doc"}
        valid_doc["_id"] = ObjectId()
        invalid_doc["_id"] = ObjectId()
        mongo.db.documents.insert_one(valid_doc)
        mongo.db.documents.insert_one(invalid_doc)
        response = self.client.get('/home')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Valid Doc", response.data)
        self.assertIn(b"Invalid Doc", response.data)

    def test_result_found(self):
        # Insertar un documento y solicitar su detalle
        doc = {"Year": "2022", "Title": "Detail Doc", "abstract": "abs", "citations": [], "keywords": "", "bibliography": ""}
        result = mongo.db.documents.insert_one(doc)
        doc_id = str(result.inserted_id)
        response = self.client.get(f'/result/{doc_id}')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Detail Doc", response.data)

    def test_result_not_found(self):
        # Solicitar un documento que no existe
        fake_id = str(ObjectId())
        response = self.client.get(f'/result/{fake_id}', follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Documento no encontrado", response.data)

    def test_search(self):
        # Insertar un documento para luego buscarlo
        doc = {"Year": "2022", "Title": "Searchable Title", "abstract": "abs", "citations": []}
        doc["_id"] = ObjectId()
        mongo.db.documents.insert_one(doc)
        response = self.client.post('/search', data={'query': 'Searchable'}, follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Searchable Title", response.data)

    def test_delete_all(self):
        # Insertar un documento y luego eliminarlo
        mongo.db.documents.insert_one({"Year": "2022", "Title": "To be deleted", "citations": []})
        response = self.client.post('/delete_all', follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(b"To be deleted", response.data)

    # --- Tests para el módulo de uploads ---
    def test_upload_pdf_page(self):
        response = self.client.get('/uploads/upload_pdf_page')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"upload", response.data)  # Asumiendo que la plantilla contiene la palabra "upload"

    def test_upload_pdf(self):
        # Simular la subida de un PDF mediante BytesIO
        data = {
            'pdf': (io.BytesIO(b"%PDF-1.4 Fake PDF content"), "test.pdf"),
            'autores': 'Test Author'
        }
        response = self.client.post('/uploads/upload_pdf', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Test Title", response.data)  # Fake title según nuestro monkey-patch

    def test_upload_folder(self):
        # Simular la subida de múltiples PDFs
        data = {
            'pdfs': [
                (io.BytesIO(b"%PDF-1.4 Fake PDF content"), "test1.pdf"),
                (io.BytesIO(b"%PDF-1.4 Fake PDF content"), "test2.pdf")
            ]
        }
        response = self.client.post('/uploads/upload_folder', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Se han subido 2 documentos", response.data)

    def test_upload_excel(self):
        # Crear un archivo Excel en memoria con openpyxl
        wb = Workbook()
        ws = wb.active
        headers = ["Year", "Title", "Category", "Type", "Acronym", "Cites", "Pag.", "Obs.", "Summary", "link", "citation", "abstract"]
        ws.append(headers)
        row = ["2022", "Excel Doc", "Cat", "Type", "Acr", "Cites", "10", "Obs", "Summary", "http://link", "Citation", "abstract"]
        ws.append(row)
        excel_io = io.BytesIO()
        wb.save(excel_io)
        excel_io.seek(0)
        data = {
            'excel': (excel_io, "test.xlsx")
        }
        response = self.client.post('/uploads/upload_excel', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Excel Doc", response.data)

if __name__ == '__main__':
    unittest.main()
