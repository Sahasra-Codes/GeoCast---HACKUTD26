from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .chat import router as chat_router
from .public_data import router as public_router
from . import observations

app = FastAPI(title='GeoCast API')
app.add_middleware(CORSMiddleware,allow_origin_regex=r'https?://(localhost|127\.0\.0\.1)(:\d+)?',allow_credentials=False,allow_methods=['GET','POST','OPTIONS'],allow_headers=['Content-Type','Authorization'])
app.include_router(chat_router)
app.include_router(public_router)

@app.get('/api/health')
def health() -> dict[str,str]:
    return {'status':'ok'}
