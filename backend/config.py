from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    db_server: str
    db_name: str
    db_user: str
    db_password: str
    db_driver: str = "ODBC Driver 17 for SQL Server"
    sv_ip: str = "localhost"
    sv_port: int = 5050
    cors_origins: list[str] = ["http://localhost:8080"]
    cache_ttl: int = 300


settings = Settings()
