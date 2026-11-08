from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .chat import router as chat_router
from .public_data import router as public_router
from .resources import router as resources_router
from .insights_priority import router as priority_router
from .relief_context import router as relief_context_router
from .scenarios import router as scenarios_router
from . import observations

app = FastAPI(title='GeoCast API')
app.add_middleware(CORSMiddleware,allow_origin_regex=r'https?://(localhost|127\.0\.0\.1)(:\d+)?',allow_credentials=False,allow_methods=['GET','POST','OPTIONS'],allow_headers=['Content-Type','Authorization'])
app.include_router(chat_router)
app.include_router(public_router)
app.include_router(resources_router)
app.include_router(priority_router)
app.include_router(relief_context_router)
app.include_router(scenarios_router)

@app.get('/api/health')
def health() -> dict[str,str]:
    return {'status':'ok'}
