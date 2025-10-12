"""
Utilidades de autenticación centralizadas
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.core import AuthenticationError
from app.repositories.user_repository import UserRepository

# Configuración de password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configuración de Bearer token
# auto_error=False para manejar errores con nuestras excepciones personalizadas
security = HTTPBearer(auto_error=False)

# ============================================
# PASSWORD HASHING
# ============================================

def hash_password(password: str) -> str:
    """Hashear una contraseña"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar una contraseña contra su hash"""
    return pwd_context.verify(plain_password, hashed_password)

# ============================================
# JWT TOKENS
# ============================================

def create_access_token(email: str) -> str:
    """Crear un token JWT para el usuario"""
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    data = {
        "sub": email,  # "sub" es el estándar JWT para identificar al usuario
        "exp": expire
    }
    
    token = jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token

def decode_token(token: str) -> Optional[str]:
    """Decodificar un token JWT y devolver el email del usuario"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        return email
    except JWTError:
        return None

# ============================================
# DEPENDENCIAS (para usar con Depends())
# ============================================

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    """
    Dependencia para obtener el usuario actual desde el token.
    Se usa así: @router.get("/ruta", dependencies=[Depends(get_current_user)])
    
    Esta función se ejecuta ANTES de tu endpoint y verifica:
    1. Que el token exista (401 si no hay)
    2. Que el token sea válido (401 si es inválido/expirado)
    3. Que el usuario exista en la BD (404 si no existe)
    """
    # 1. Verificar que se envió el header Authorization
    if credentials is None:
        raise AuthenticationError("No se proporcionó token de autenticación")
    
    # 2. Extraer el token del header Authorization: Bearer <token>
    token = credentials.credentials
    
    # 3. Decodificar el token
    email = decode_token(token)
    
    if email is None:
        raise AuthenticationError("Token inválido o expirado")
    
    # 4. Buscar el usuario en la base de datos
    user_repo = UserRepository()
    user = await user_repo.find_by_email(email)
    
    if user is None:
        # Si el token es válido pero el usuario no existe, el token ya no es útil
        # El usuario debe hacer login de nuevo
        raise AuthenticationError("Usuario no encontrado o cuenta eliminada")
    
    return user

