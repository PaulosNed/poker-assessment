from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from src.api.schemas import ErrorOutput, HandInput, HandOutput
from src.domain.models import Hand
from src.services.hands import HandService

router = APIRouter(prefix="/api/v1/hands", tags=["Hands"])


def hand_service(request: Request) -> HandService:
    return request.app.state.hand_service


Service = Annotated[HandService, Depends(hand_service)]


@router.post(
    "",
    response_model=HandOutput,
    status_code=201,
    summary="Validate, settle, and save a completed hand",
    description=(
        "Replays every decision with PokerKit and commits the hand,"
        " participating players, and actions atomically. Only 2–6 active seats"
        " are submitted. Each player supplies their own startingStack, before"
        " blinds. Do not send winLoss, database IDs, or timestamps. PokerKit"
        " calculates net payoffs. Retries with an identical submissionId and"
        " hand return the original record (200); different data returns 409."
        " Player array order and action array order are ignored; actions are"
        " ordered by sequence. Card order and sequence values remain part of"
        " the submitted data. Validation covers this hand only; continuity"
        " between hands belongs to the frontend. In Try it out, use the"
        " provided valid six-player fold example. Change submissionId to save"
        " a new hand."
    ),
    responses={
        200: {
            "model": HandOutput,
            "description": "Identical submission already saved",
        },
        409: {
            "model": ErrorOutput,
            "description": "submissionId reused with different data",
        },
        422: {
            "description": "Invalid request or illegal/incomplete poker hand"
        },
        503: {
            "model": ErrorOutput,
            "description": "Database unavailable; retry the same submission",
        },
        500: {"model": ErrorOutput, "description": "Unexpected server error"},
    },
)
def submit_hand(
    payload: HandInput, response: Response, service: Service
) -> Hand:
    hand, created = service.submit(payload.to_domain())
    response.status_code = 201 if created else 200
    return hand


@router.get(
    "",
    response_model=list[HandOutput],
    summary="List completed hands, newest first",
    description=(
        "Returns all saved hands with participating players and actions"
        " ordered by sequence. Empty history is []."
    ),
    responses={
        503: {"model": ErrorOutput, "description": "Database unavailable"}
    },
)
def list_hands(service: Service) -> list[Hand]:
    return service.list()
