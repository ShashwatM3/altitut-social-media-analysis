from fastapi import FastAPI

app = FastAPI(title="ALTITUT Social Media Analysis API", version="0.1.0")


@app.get("/")
async def root() -> dict:
    return {"message": "Hello, world!"}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
