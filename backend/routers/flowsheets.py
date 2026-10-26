import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException
from fastapi import Path as PathParam

from ..schemas import Flowsheet

router = APIRouter(prefix="/api/flowsheets", tags=["flowsheets"])

DIRECTORIO = Path(__file__).resolve().parents[2] / "frontend" / "flowsheets"

SlugPath = Annotated[str, PathParam(pattern=r"^[a-z0-9_-]+$", description="Nombre del JSON en frontend/flowsheets")]


def archivo(slug: str) -> Path:
    """Solo flowsheets existentes: los nuevos se crean a mano y se registran en flowsheets/index.ts."""
    ruta = DIRECTORIO / f"{slug}.json"
    if not ruta.is_file():
        raise HTTPException(404, f"Flowsheet {slug} no encontrado")
    return ruta


def serializar(fs: Flowsheet) -> str:
    """Un botón por línea, igual que los JSON escritos a mano (diffs legibles)."""
    botones = ",\n".join(f"    {{ {json.dumps(b.model_dump(), ensure_ascii=False)[1:-1]} }}" for b in fs.buttons)
    cabecera = json.dumps({"title": fs.title, "image": fs.image}, indent=2, ensure_ascii=False)[:-2]
    return f'{cabecera},\n  "buttons": [\n{botones}\n  ]\n}}\n'


@router.get("/{slug}")
def get_flowsheet(slug: SlugPath) -> Flowsheet:
    return Flowsheet.model_validate_json(archivo(slug).read_text(encoding="utf-8"))


@router.put("/{slug}")
def put_flowsheet(slug: SlugPath, fs: Flowsheet) -> Flowsheet:
    archivo(slug).write_text(serializar(fs), encoding="utf-8", newline="\n")
    return fs
