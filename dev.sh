#!/usr/bin/env bash
# Starts the FastAPI backend (port 8000) and the Vite frontend (port 5173) together.
set -e
cd "$(dirname "$0")"

if [ ! -f frontend/.env.local ]; then
  echo "Missing frontend/.env.local. Copy frontend/.env.example and add your Supabase URL and publishable key."
  exit 1
fi
if [ ! -f backend/.env ]; then
  echo "Missing backend/.env. Copy backend/.env.example and add your SUPABASE_URL."
  exit 1
fi

if [ ! -d backend/.venv ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q --upgrade pip
fi
echo "Checking Python packages..."
backend/.venv/bin/pip install -q -r backend/requirements.txt
echo "Checking frontend packages..."
(cd frontend && npm install --silent)

(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

echo "Backend:  http://localhost:8000/api/health"
echo "Frontend: http://localhost:5173"
cd frontend && npm run dev
