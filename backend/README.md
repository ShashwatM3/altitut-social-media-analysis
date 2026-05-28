# Backend

This folder contains backend services:
- `api/` FastAPI service
- `db/` database layer (placeholder)
- `agent/` agent service (placeholder)

## Run API locally

cd api
pip install -r requirements.txt
uvicorn main:app --reload

## Build Docker image

cd ..
docker build -t project-backend-api .

## Run Docker container

docker run --rm -p 8000:8000 project-backend-api

Then open:
- http://localhost:8000
- http://localhost:8000/docs
