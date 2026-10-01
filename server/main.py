from fastapi import FastAPI

from src.api.health import router as health_router

app = FastAPI(title="Poker Assessment API")
app.include_router(health_router)
