from fastapi import FastAPI
from .chat import router as chat_router

app = FastAPI(title="HackUTD API")
app.include_router(chat_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
