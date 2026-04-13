"""
Modelos de datos de la aplicación.

Contiene los schemas de Pydantic para validación de INPUT (Request).

Organización por funcionalidad:
- auth.py: Autenticación (register, login)
- user.py: Perfil de usuario (update profile, change password)
- pdf.py: PDFs
- article.py: Artículos
"""

# Auth models (autenticación)
from app.models.auth import (
    UserRegister,
    UserLogin
)

# User models (perfil)
from app.models.user import (
    UserProfileUpdate,
    ChangePasswordRequest
)

# PDF models
from app.models.pdf import (
    PdfUpload
)
from app.models.pdf_processing import (
    PdfMetadata
)
from app.models.research_artifacts import (
    ArticleExtractionData,
    CollectionSynthesisData,
    CollectionSynthesisRunRequest,
    EvidenceExtractionRunData,
    ScreeningDecisionData,
    ScreeningRunCounts,
    ScreeningRunData,
    SupportSnippetReference,
)
from app.models.evidence_extraction import (
    EvidenceExtractionRunRequest,
    EvidenceExtractionLLMResult,
    EvidenceExtractionObjectiveResult,
    EvidenceExtractionMethodsResult,
    EvidenceExtractionFindingsResult,
)

# Excel models
from app.models.excel import (
    ExcelUpload
)

# Article models
from app.models.article import (
    Pagination,
    QueryBody,
    ArticleUpdate
)

# Collection models
from app.models.collection import (
    CollectionCreate,
    AddArticleToCollection
)
from app.models.screening import (
    ScreeningRunRequest,
    ScreeningDecisionLLMResult,
    ScreeningDecisionUpdateRequest,
)

# AI Assistant models
from app.models.ai_assistant import (
    ChatRequest
)

# Knowledge Graph models
from app.models.knowledge_graph import (
    KnowledgeGraphBackfillRequest
)

__all__ = [
    # Auth (autenticación)
    "UserRegister",
    "UserLogin",
    
    # User (perfil)
    "UserProfileUpdate",
    "ChangePasswordRequest",
    
    # PDF
    "PdfUpload",
    "PdfMetadata",
    "ExcelUpload",
    "ArticleExtractionData",
    "CollectionSynthesisData",
    "CollectionSynthesisRunRequest",
    "EvidenceExtractionRunData",
    "SupportSnippetReference",
    "EvidenceExtractionRunRequest",
    "EvidenceExtractionLLMResult",
    "EvidenceExtractionObjectiveResult",
    "EvidenceExtractionMethodsResult",
    "EvidenceExtractionFindingsResult",
    "ScreeningDecisionData",
    "ScreeningRunCounts",
    "ScreeningRunData",
    
    # Article
    "Pagination",
    "QueryBody",
    "ArticleUpdate",
    
    # Collection
    "CollectionCreate",
    "AddArticleToCollection",
    "ScreeningRunRequest",
    "ScreeningDecisionLLMResult",
    "ScreeningDecisionUpdateRequest",

    # AI Assistant
    "ChatRequest",

    # Knowledge Graph
    "KnowledgeGraphBackfillRequest",
]
