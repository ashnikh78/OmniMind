from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import os
import json
from pathlib import Path

router = APIRouter(prefix="/api/v1/documentation", tags=["documentation"])

class DocumentationSection(BaseModel):
    id: str
    title: str
    content: str
    type: str
    order: int

DOCS_DIR = Path("docs")

def load_documentation_file(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Documentation file not found: {str(e)}")

@router.get("/sections", response_model=List[DocumentationSection])
async def get_documentation_sections():
    sections = []
    for doc_type in ["user-guide", "security", "api", "architecture"]:
        doc_path = DOCS_DIR / doc_type / "README.md"
        if doc_path.exists():
            content = load_documentation_file(str(doc_path))
            sections.append(DocumentationSection(
                id=f"{doc_type}-overview",
                title=f"{doc_type.title()} Overview",
                content=content,
                type=doc_type,
                order=1
            ))
    return sections

@router.get("/content/{section_id}", response_model=DocumentationSection)
async def get_documentation_content(section_id: str):
    doc_type, section = section_id.split("-", 1)
    doc_path = DOCS_DIR / doc_type / f"{section}.md"
    
    if not doc_path.exists():
        raise HTTPException(status_code=404, detail="Documentation section not found")
    
    content = load_documentation_file(str(doc_path))
    return DocumentationSection(
        id=section_id,
        title=section.replace("-", " ").title(),
        content=content,
        type=doc_type,
        order=1
    )

@router.get("/search")
async def search_documentation(query: str):
    results = []
    for doc_type in ["user-guide", "security", "api", "architecture"]:
        doc_dir = DOCS_DIR / doc_type
        if doc_dir.exists():
            for file_path in doc_dir.glob("*.md"):
                content = load_documentation_file(str(file_path))
                if query.lower() in content.lower():
                    results.append(DocumentationSection(
                        id=f"{doc_type}-{file_path.stem}",
                        title=file_path.stem.replace("-", " ").title(),
                        content=content,
                        type=doc_type,
                        order=1
                    ))
    return results

@router.get("/type/{doc_type}", response_model=List[DocumentationSection])
async def get_documentation_by_type(doc_type: str):
    if doc_type not in ["user-guide", "security", "api", "architecture"]:
        raise HTTPException(status_code=400, detail="Invalid documentation type")
    
    sections = []
    doc_dir = DOCS_DIR / doc_type
    if doc_dir.exists():
        for file_path in doc_dir.glob("*.md"):
            content = load_documentation_file(str(file_path))
            sections.append(DocumentationSection(
                id=f"{doc_type}-{file_path.stem}",
                title=file_path.stem.replace("-", " ").title(),
                content=content,
                type=doc_type,
                order=1
            ))
    return sections 