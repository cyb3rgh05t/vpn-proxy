from sqlalchemy.orm import Session
from app.models.user import User
from app.utils.security import hash_password, verify_password, create_access_token


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(
    db: Session, username: str, password: str, is_admin: bool = False
) -> User:
    user = User(
        username=username,
        hashed_password=hash_password(password),
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_count(db: Session) -> int:
    return db.query(User).count()


def generate_token(user: User) -> str:
    return create_access_token({"sub": str(user.id)})
