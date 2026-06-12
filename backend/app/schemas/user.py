import re
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional

from app.core.config import settings

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")


class UserBase(BaseModel):
    username: str
    email: EmailStr

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if not _USERNAME_RE.match(v):
            raise ValueError("Username must be 3-32 characters (letters, numbers, underscore)")
        return v


class UserCreate(UserBase):
    password: str
    role: Optional[str] = "user"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < settings.PASSWORD_MIN_LENGTH:
            raise ValueError(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must include at least one letter and one number")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> str:
        allowed = {"user", "supervisor", "admin", "lead"}
        role = (v or "user").lower()
        if role not in allowed:
            raise ValueError("Invalid role")
        return role


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True