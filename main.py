import re
import PyPDF2

def extract_text_from_pdf(pdf_path):
    """
    Extrae el texto completo de un archivo PDF.
    """
    full_text = ""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
    return full_text

def extract_abstract(text):
    """
    Busca y extrae el abstract. Se asume que comienza con la palabra "Abstract"
    y termina antes de 'Keywords', 'Palabras clave', 'Introduction' o 'Introducción'.
    """
    pattern = r'(Abstract\s*[:.-]*)(.*?)(?=\n\s*(Keywords|Palabras clave|Introduction|Introducción))'
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(2).strip()
    else:
        return "No se encontró el abstract."

def extract_keywords(text):
    """
    Busca y extrae los keywords. Se asume que aparecen después de "Keywords" o "Palabras clave:".
    """
    pattern = r'(Keywords|Palabras clave)\s*[:.-]*\s*(.*?)(?=\n)'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(2).strip()
    else:
        return "No se encontraron keywords."

def extract_sections(text):
    """
    Intenta separar el texto en secciones. Se asume que las secciones comienzan con un número
    seguido de punto o guion y una palabra (ej. "1. Introducción").
    Esta función devuelve una lista de secciones encontradas.
    """
    # Esta expresión regular busca líneas que comienzan con un número y una posible puntuación.
    sections = re.split(r'\n(?=\d+\s*[\.\-]\s*\w)', text)
    # Limpiamos cada sección eliminando espacios adicionales.
    sections = [sec.strip() for sec in sections if sec.strip()]
    return sections

def extract_bibliography(text):
    """
    Extrae la bibliografía asumiendo que el título (References, Bibliography o Referencias)
    es la primera palabra de una línea o del documento. Extrae el contenido hasta que se encuentre
    un marcador de nueva sección (por ejemplo, "Appendix", "Anexo", etc.) o hasta el final.
    """
    # El patrón exige que antes del encabezado exista un inicio de línea o el inicio del documento.
    pattern = r'(^|\n)\s*(References|Bibliography|eferences)\s*[:.-]*\s*(.*)'
    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL)
    if match:
        biblio_text = match.group(3).strip()
        # Se busca un marcador que indique el inicio de otra sección para delimitar el fin de la bibliografía.
        end_pattern = r'(?:\n\s*(?:Appendix|Anexo|Apendices|Supplementary|Suplementario)|received the)'
        end_match = re.search(end_pattern, biblio_text, re.IGNORECASE)
        if end_match:
            biblio_text = biblio_text[:end_match.start()].strip()
        return biblio_text
    else:
        return "No se encontró la bibliografía."

def extract_citations(text):
    """
    Extrae todas las citas de un bloque de texto de bibliografía.
    Se asume que cada cita comienza con [número] y se extiende hasta el inicio
    de la siguiente cita o el final del bloque.
    Devuelve una lista con cada entrada de cita formateada de forma limpia.
    """
    # El patrón busca: [número] seguido de cualquier contenido hasta el siguiente [número] o el final.
    pattern = re.compile(r'\[(\d+)\](.*?)(?=\[\d+\]|$)', re.DOTALL)
    
    citations = []
    for match in pattern.finditer(text):
        number = match.group(1)
        content = match.group(2)
        # Limpieza: se eliminan saltos de línea y se unifican los espacios
        cleaned = ' '.join(content.split())
        citation_entry = f"[{number}] {cleaned}"
        citations.append(citation_entry)
    return citations

def main(pdf_path):
    # Extraemos el texto del PDF
    text = extract_text_from_pdf(pdf_path)
    
    # Extraer y mostrar el abstract
    abstract = extract_abstract(text)
    print("Abstract:")
    print(abstract)
    print("\n" + "="*50 + "\n")
    
    # Extraer y mostrar los keywords
    keywords = extract_keywords(text)
    print("Keywords:")
    print(keywords)
    print("\n" + "="*50 + "\n")
    
    # Extraer y mostrar la bibliografía
    bibliography = extract_bibliography(text)
   # print("Bibliografía:")
   # print(bibliography)
   # print("\n" + "="*50 + "\n")
    
    # Extraer y mostrar las citas de la bibliografía
    citations = extract_citations(bibliography)
    print("Citas extraídas: ", len(citations))
    '''for citation in citations:
        print(citation)
        print("-" * 30)'''

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Uso: python script.py <ruta_al_pdf>")
    else:
        pdf_path = sys.argv[1]
        main(pdf_path)
