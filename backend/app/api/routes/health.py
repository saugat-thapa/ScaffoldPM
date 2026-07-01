from fastapi import APIRouter, UploadFile, File
from app.core.config import settings
from app.modules.wbs.document_extractor import extract_document_text

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "debug": settings.DEBUG,
    }


@router.post("/health/extract")
async def extract_document(file: UploadFile = File(...)):
    data = await file.read()
    text = extract_document_text(file.filename, file.content_type, data)
    return {"text": text}