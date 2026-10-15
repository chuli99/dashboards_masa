from collections.abc import Iterator
from typing import Annotated
from urllib.parse import quote_plus

from fastapi import Depends
from sqlalchemy import Connection, create_engine

from .config import settings


def _conn_str() -> str:
    return (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_name};"
        f"UID={settings.db_user};"
        f"PWD={settings.db_password};"
        "TrustServerCertificate=yes;"
    )


engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={quote_plus(_conn_str())}",
    pool_size=5,
    max_overflow=10,
)


def get_conn() -> Iterator[Connection]:
    """Una conexión del pool por request; se devuelve al terminar."""
    with engine.connect() as conn:
        yield conn


ConnDep = Annotated[Connection, Depends(get_conn)]
