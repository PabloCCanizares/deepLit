# Controllers

from .auth_controller import AuthController
from .pdfs_controller import PdfsController
from.excels_controller import ExcelsController
from .user_controller import UserController
from .articles_controller import ArticlesController
from .stats_controller import StatsController
from .openalex_controller import OpenAlexController
from .ai_assistant_controller import AiAssistantController
from .knowledge_graph_controller import KnowledgeGraphController
from .screening_controller import ScreeningController
from .collection_synthesis_controller import CollectionSynthesisController

__all__ = [
    "AuthController",
    "PdfsController",
    "ExcelsController",
    "UserController",
    "ArticlesController",
    "StatsController",
    "OpenAlexController",
    "AiAssistantController",
    "KnowledgeGraphController",
    "ScreeningController",
    "CollectionSynthesisController",
]
