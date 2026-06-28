from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT Functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

# Password Hashing
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# AES-256-GCM Encryption
def encrypt_data(data: bytes) -> tuple[bytes, bytes]:
    aesgcm = AESGCM(settings.ENCRYPTION_KEY.encode()[:32])
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, data, None)
    return ciphertext, nonce

def decrypt_data(ciphertext: bytes, nonce: bytes) -> bytes:
    aesgcm = AESGCM(settings.ENCRYPTION_KEY.encode()[:32])
    return aesgcm.decrypt(nonce, ciphertext, None)


def create_refresh_token(data: dict):
    """Create a refresh token (longer expiry) with a JTI for rotation.

    The token payload includes a `jti` field (unique id) which should be stored
    server-side (e.g., in the AdminSession) to support revocation and rotation.
    Returns: (token, jti, expiry_datetime)
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    # generate a jti
    import uuid as _uuid
    jti = str(_uuid.uuid4())
    to_encode.update({"exp": expire, "jti": jti})
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti, expire