# HackUTD

React (Vite) frontend and FastAPI backend. Use Node.js 22+ and Python 3.10+.

## Backend

In a terminal from the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000/api/health
Interactive API docs: http://127.0.0.1:8000/docs

On macOS/Linux, use `.venv/bin/python` instead of `.venv\Scripts\python.exe`.

## Frontend

In a second terminal from the repository root:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the URL Vite prints (normally http://localhost:5173).
Vite proxies `/api` requests to the backend on port 8000 during development.

## Production build

```powershell
cd frontend
npm.cmd run build
```

The frontend build is written to `frontend/dist`. For deployment, configure your
web server to forward `/api` to FastAPI; the Vite proxy only runs in development.
