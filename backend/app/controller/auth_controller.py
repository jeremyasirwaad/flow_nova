"""Authentication controller with password hashing and JWT."""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import TokenData

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = "your-secret-key-change-this-in-production"  # TODO: Move to .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")

        if user_id is None:
            return None

        return TokenData(user_id=UUID(user_id), email=email)
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Get a user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
    """Get a user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """Authenticate a user by email and password."""
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


async def create_user(
    db: AsyncSession,
    email: str,
    first_name: str,
    last_name: str,
    password: str,
    is_superuser: bool = False,
) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(password)

    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        password=hashed_password,
        is_superuser=is_superuser,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user
