from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


class Database:
    client: AsyncIOMotorClient = None
    
db = Database()


async def connect_to_mongo():
    """Conectar a MongoDB"""
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    print(f"✅ Connected to MongoDB: {settings.DATABASE_NAME}")

async def close_mongo_connection():
    """Cerrar la conexión a MongoDB"""
    db.client.close()
    print("❌ Closed MongoDB connection")

def get_database():
    """Obtener la instancia de la base de datos"""
    return db.client[settings.DATABASE_NAME]

