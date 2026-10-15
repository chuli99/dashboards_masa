from fastapi import APIRouter

from .. import repositorio
from ..database import ConnDep
from ..schemas import Health

router = APIRouter(tags=["health"])


@router.get("/health")
def health(conn: ConnDep) -> Health:
    repositorio.ping(conn)
    return Health(status="ok")
