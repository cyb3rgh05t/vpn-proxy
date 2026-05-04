import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.app_template import AppTemplate
from app.schemas.app_template import (
    AppTemplate as AppTemplateSchema,
    AppTemplateCreate,
    AppTemplateUpdate,
)
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/app-templates", tags=["app-templates"])


@router.get("", response_model=list[AppTemplateSchema])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(AppTemplate).order_by(AppTemplate.title.asc()).all()
    return rows


@router.get("/{template_id}", response_model=AppTemplateSchema)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    return row


@router.post("", response_model=AppTemplateSchema, status_code=201)
def create_template(
    payload: AppTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tid = payload.id.strip().lower()
    if db.query(AppTemplate).filter(AppTemplate.id == tid).first():
        raise HTTPException(status_code=409, detail=f"Template '{tid}' already exists")
    row = AppTemplate(
        id=tid,
        title=payload.title,
        subtitle=payload.subtitle,
        image=payload.image,
        suggested_name=payload.suggested_name,
        restart_policy=payload.restart_policy or "unless-stopped",
        env_vars=payload.env_vars or [],
        ports=payload.ports or [],
        volumes=payload.volumes or [],
        devices=payload.devices or [],
        labels=payload.labels or [],
        is_builtin=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{template_id}", response_model=AppTemplateSchema)
def update_template(
    template_id: str,
    payload: AppTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    row.title = payload.title
    row.subtitle = payload.subtitle
    row.image = payload.image
    row.suggested_name = payload.suggested_name
    row.restart_policy = payload.restart_policy or "unless-stopped"
    row.env_vars = payload.env_vars or []
    row.ports = payload.ports or []
    row.volumes = payload.volumes or []
    row.devices = payload.devices or []
    row.labels = payload.labels or []
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(row)
    db.commit()
    return None
