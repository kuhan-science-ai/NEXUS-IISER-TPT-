from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import time
import bcrypt
import jwt
from backend.app.core.config import settings

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(now.timestamp()), "token_type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(now.timestamp()), "token_type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None

class RateLimiter:
    """In-memory rate limiter with sliding window for login attempt protection."""
    def __init__(self):
        self._attempts: Dict[str, list[float]] = {}

    def is_rate_limited(self, key: str, max_attempts: int = 5, window_seconds: int = 300) -> bool:
        now = time.time()
        window_start = now - window_seconds
        
        # Clean older entries
        if key in self._attempts:
            self._attempts[key] = [t for t in self._attempts[key] if t > window_start]
        else:
            self._attempts[key] = []

        if len(self._attempts[key]) >= max_attempts:
            return True
        return False

    def record_attempt(self, key: str) -> None:
        now = time.time()
        if key not in self._attempts:
            self._attempts[key] = []
        self._attempts[key].append(now)

    def reset(self, key: str) -> None:
        if key in self._attempts:
            del self._attempts[key]

login_rate_limiter = RateLimiter()
