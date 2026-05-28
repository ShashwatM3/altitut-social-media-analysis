# GitHub Workflow Guide

This project uses GitHub Actions in `.github/workflows/`.

## Current workflows

- `lint.yml` runs linting and type checks on push/pull requests.
- `deploy.yml` is a placeholder for deployment on pushes to `main`.

## CI/CD pipeline plan

1. Keep lint/type/security checks in `lint.yml`.
2. Add Docker image build and push in `deploy.yml`.
3. Add deployment target (ECS, Kubernetes, or VM).
4. Store secrets in GitHub repository secrets.
5. Require successful checks before merging to `main`.
