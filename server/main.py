import logging
import os
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from src.api.hands import router as hands_router
from src.api.health import router as health_router
from src.domain.errors import InvalidHand, SubmissionConflict
from src.infrastructure.database import initialize_database
from src.infrastructure.hand_repository import PostgresHandRepository
from src.infrastructure.pokerkit_settlement import PokerKitSettlement
from src.services.hands import HandService

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    database_url = os.environ["DATABASE_URL"]
    await run_in_threadpool(initialize_database, database_url)
    app.state.hand_service = HandService(
        PostgresHandRepository(database_url), PokerKitSettlement()
    )
    yield


app = FastAPI(
    title="Poker Hand API",
    version="1.0.0",
    lifespan=lifespan,
    description=(
        "Authoritative settlement and history for a single-user Texas Hold'em"
        " simulator. No ante, blinds 20/40, minimum bet 40, one board, no"
        " rake. The frontend runs live gameplay; this API only accepts"
        " completed hands. All chip values are whole numbers. Total submitted"
        " starting stacks must not exceed 9007199254740990, the chip supply of"
        " six maximum JavaScript-safe initial stacks. Starting stacks belong"
        " to each participating player, not the hand. Ending stack ="
        " startingStack + winLoss."
    ),
)
app.include_router(health_router)
app.include_router(hands_router)


@app.exception_handler(RequestValidationError)
async def request_validation_error(
    request: Request, error: RequestValidationError
):
    # Avoid logging request bodies; they can contain unexpected
    # sensitive fields.
    details = [
        {"loc": e["loc"], "msg": e["msg"], "type": e["type"]}
        for e in error.errors()
    ]
    logger.warning(
        "Request validation failed: %s %s; %s",
        request.method,
        request.url.path,
        details,
    )
    return JSONResponse(status_code=422, content={"detail": details})


@app.exception_handler(InvalidHand)
@app.exception_handler(SubmissionConflict)
async def application_error(request: Request, error: Exception):
    logger.warning("Hand submission rejected: %s", error, exc_info=error)
    return JSONResponse(
        status_code=409 if isinstance(error, SubmissionConflict) else 422,
        content={"detail": str(error)},
    )


@app.exception_handler(psycopg.OperationalError)
async def database_error(request: Request, error: Exception):
    logger.error(
        "Database operation failed: %s %s",
        request.method,
        request.url.path,
        exc_info=error,
    )
    return JSONResponse(
        status_code=503,
        content={
            "detail": "The database is unavailable. Please retry the request."
        },
    )


@app.exception_handler(Exception)
async def unexpected_error(request: Request, error: Exception):
    logger.error(
        "Unexpected API failure: %s %s",
        request.method,
        request.url.path,
        exc_info=error,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": (
                "The request could not be completed. Please retry; if it"
                " persists, check the server logs."
            )
        },
    )
