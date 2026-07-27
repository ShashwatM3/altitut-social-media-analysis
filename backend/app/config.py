"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    embedding_dimensions: int = 512

    # Exa
    exa_api_key: str
    exa_base_url: str = "https://api.exa.ai"

    # Apify
    apify_token: str
    apify_actor_id: str = "apify/instagram-profile-scraper"

    # Telegram
    telegram_bot_token: str | None = None
    telegram_webhook_secret: str | None = None

    # Upload-Post (Auto-Post)
    upload_post_api_key: str | None = None
    upload_post_base_url: str = "https://api.upload-post.com/api"
    upload_post_profile: str = "altitut"
    social_provider: str = "upload_post"

    # Firebase
    firebase_project_id: str = "altitut-sma-dashboard"
    firebase_service_account_path: str | None = None
    firebase_service_account_json: str | None = None

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None

    @property
    def broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def result_backend(self) -> str:
        return self.celery_result_backend or self.redis_url


settings = Settings()
