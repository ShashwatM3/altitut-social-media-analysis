from fastapi import FastAPI

from backend.connectors.apify import ApifyConnector
from backend.settings import load_runtime_config

runtime = load_runtime_config()
app = FastAPI(title=runtime.app.name, version=runtime.app.version)


@app.get("/")
async def root() -> dict:
    return {"message": "ALTITUT Social Media Analysis API", "status": "ok"}


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": runtime.app.name,
        "version": runtime.app.version,
    }


@app.get("/integrations/apify/status")
async def apify_status() -> dict:
    return ApifyConnector().status().to_dict()
