#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DOCKERHUB_NAMESPACE:-${DOCKERHUB_USER:-}}" ]]; then
  echo "DOCKERHUB_NAMESPACE is required (e.g. export DOCKERHUB_NAMESPACE=trackit)."
  exit 1
fi

DOCKERHUB_NAMESPACE="${DOCKERHUB_NAMESPACE:-${DOCKERHUB_USER:-}}"
if [[ "${DOCKERHUB_NAMESPACE}" == *"@"* ]]; then
  echo "DOCKERHUB_NAMESPACE must be your Docker Hub username/org (not an email)."
  exit 1
fi

VERSION="${VERSION:-1.0.0}"
FRONTEND_IMAGE="${DOCKERHUB_NAMESPACE}/trackit-frontend"
BACKEND_IMAGE="${DOCKERHUB_NAMESPACE}/trackit-backend"

echo "Building images..."
docker build -t "${FRONTEND_IMAGE}:${VERSION}" -t "${FRONTEND_IMAGE}:latest" ./frontend
docker build -t "${BACKEND_IMAGE}:${VERSION}" -t "${BACKEND_IMAGE}:latest" ./backend

echo "Pushing images..."
docker push "${FRONTEND_IMAGE}:${VERSION}"
docker push "${FRONTEND_IMAGE}:latest"
docker push "${BACKEND_IMAGE}:${VERSION}"
docker push "${BACKEND_IMAGE}:latest"

echo "Done."
