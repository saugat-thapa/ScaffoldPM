from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "ScaffoldPM"
    DEBUG: bool = True
    OPENAI_API_KEY: str
    DATABASE_URL: str = "sqlite+aiosqlite:///./scaffoldpm.db"

    class Config:
        env_file = ".env"

settings = Settings()