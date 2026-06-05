import logging
from urllib.parse import quote_plus
from sqlalchemy.ext.asyncio import create_async_engine
from .config import settings

logger = logging.getLogger(__name__)


def _build_conn_str() -> str:
    conn = (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_name};"
        f"UID={settings.db_user};"
        f"PWD={settings.db_password};"
        "TrustServerCertificate=yes;"
    )
    logger.info(f"DB conn string (masked): DRIVER=...;SERVER={settings.db_server};DATABASE={settings.db_name};UID={settings.db_user};PWD=***")
    return conn


engine = create_async_engine(
    f"mssql+aioodbc:///?odbc_connect={quote_plus(_build_conn_str())}",
    pool_size=5,
    max_overflow=10,
    echo=False,
)
