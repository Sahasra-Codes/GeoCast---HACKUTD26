# GeoCast frontend

The current project overview, data provenance, three-service setup, environment configuration, demonstration flow, and validation commands are in the [main README](../README.md).

This directory contains the React + TypeScript app, built with Vite. From the repository root:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

The Python API runs on port **8002** and the Node relief service on **8001**. The app requires configured Supabase sign-in. Server-side Gemini and Census keys must never be placed in frontend code or `VITE_*` variables.

```powershell
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
```

See the root README for the current-flow Playwright suite and its browser setup.
