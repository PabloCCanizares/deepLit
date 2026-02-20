Visualización:
* Plataforma web que permita explorar diferentes artículos y explorar el estado del arte. 
 
Extracción:
* Inclusión de APIs OpenAlex, Semantic scholar (Crossref, arXiv, Unpaywall, scopus) etc, para obtener información de articulos.
* Análisis de artículos para extraer: abstract, #paginas, keywords, y contenido del artículo en texto plAño.
* Cargar múltiples carpetas de archivos y procesar.
* Técnicas snowballing (backward/fordward).
 
IA + LLMs
* Clustering de info: document embeddings para búsqueda semántica y clasificar artículos por keywords, abstract y contenido.
* Generador de resúmenes utilizando ChatGPT + prompt. 
* Extracción de características comunes de los artículos: ejemplo, Research questions.
* Transformers (BERT, SciBERT, BioBERT, Longformer, DeBERTa) para clasificar abstracts/papers como relevantes o no relevantes según tus RQs.
* Fine-tuning supervisado con tus propias decisiones (incluye/excluye), al estilo de ASReview DL, pero mejorado con embeddings contextualizados. PD: Echar un ojo a: https://asreview.nl
* Asistente virtual con ChatGPT y langchain. 
