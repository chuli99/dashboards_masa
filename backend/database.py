from urllib.parse import quote_plus
from sqlalchemy import create_engine
from .config import settings


def _build_conn_str() -> str:
    return (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_name};"
        f"UID={settings.db_user};"
        f"PWD={settings.db_password};"
        "TrustServerCertificate=yes;"
    )


engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={quote_plus(_build_conn_str())}",
    pool_size=5,
    max_overflow=10,
    echo=False,
)
