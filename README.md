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

## GEO Guide chatbot

The bottom-right assistant answers questions through `POST /api/chat` and offers
navigation buttons for filters, assistance, and data information.

Add `GEMINI_API_KEY=your_key` to `backend/.env` and restart FastAPI. Optionally set
`GEMINI_MODEL` (default: `gemini-3.1-flash-lite`). See `backend/.env.example`.
Install updated backend requirements before starting. Keys stay on the backend.
Without a key, navigation works and chat displays a configuration message.
Chat history is kept in memory for this page session; the last 19 messages and
current filter context are sent to Gemini when you ask a question.
The Vite development proxy forwards `/api` to port 8000. For production, proxy
`/api` to FastAPI on the same origin. Do not expose provider keys through Vite.
