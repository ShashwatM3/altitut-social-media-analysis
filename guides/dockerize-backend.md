# Dockerizing the Backend

The backend is designed to be dockerizable from `backend/Dockerfile`.

## Build

cd backend
docker build -t project-backend-api .

## Run

docker run --rm -p 8000:8000 project-backend-api

## Compose (from repo root)

docker-compose up --build

## Notes

- `backend/Dockerfile` copies `api/requirements.txt`, installs dependencies, then copies API source.
- The container runs `uvicorn` on port `8000`.
- For local development, compose mounts `./backend/api` for live reload.
