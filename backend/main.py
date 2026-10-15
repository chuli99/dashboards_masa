import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .database import engine
from .routers import health, variables

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    engine.dispose()


app = FastAPI(title="PLC Dashboard API", lifespan=lifespan)

app.include_router(variables.router)
app.include_router(health.router)


@app.exception_handler(SQLAlchemyError)
def error_base_de_datos(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Un solo lugar para los errores de SQL Server: se loguean y vuelven como 500 con `detail`."""
    logger.error("Error de base de datos en %s: %s", request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": f"Error al consultar la base de datos: {exc}"})


# Frontend Next.js exportado (`pnpm build` en frontend/). Prioridad baja: las rutas /api se resuelven antes.
app.frontend("/", directory=Path(__file__).resolve().parent.parent / "frontend" / "out")
