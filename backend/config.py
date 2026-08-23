import os
from typing import List, Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENV: Literal["development", "staging", "production"] = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # Security & Auth
    JWT_SECRET: str = "medcheck-dev-secret-change-in-production-32bytes-min"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Rate Limiting
    RATE_LIMIT_CHECK: str = "10/minute"
    RATE_LIMIT_SEARCH: str = "30/minute"
    RATE_LIMIT_PROFILE: str = "20/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    
    # External APIs & Database
    MISTRAL_API_KEY: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SQLITE_DB_PATH: str = os.getenv(
        "SQLITE_DB_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_cache.db")
    )
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", ".env.local", "backend/.env.local"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

settings = Settings()

if settings.ENV == "production" and settings.JWT_SECRET == "medcheck-dev-secret-change-in-production-32bytes-min":
    raise RuntimeError("JWT_SECRET must be set to a secure key in production environment.")
