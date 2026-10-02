from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    model_validator,
)
from pydantic.alias_generators import to_camel

from src.domain.models import (
    MAX_CHIP_SUPPLY,
    ActionType,
    Card,
    HandSubmissionDTO,
    Player,
    PlayerHandSubmissionDTO,
    Street,
    ActionSubmissionDTO,
)


def integer_seat(value: object) -> object:
    if type(value) is not int and not isinstance(value, Player):
        raise ValueError("Player seats must be integers from 0 to 5.")
    return value


Seat = Annotated[Player, BeforeValidator(integer_seat)]
Chips = Annotated[int, Field(strict=True, ge=1, le=MAX_CHIP_SUPPLY)]
Sequence = Annotated[int, Field(strict=True, ge=0, le=2**31 - 1)]


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )


class PlayerInput(ApiModel):
    player: Seat
    starting_stack: Chips = Field(
        description=(
            "Stack before posting blinds. Later hands may start below 40."
        )
    )
    cards: tuple[Card, Card]


class ActionInput(ApiModel):
    player: Seat
    action_type: ActionType
    amount_to: Chips | None = Field(
        default=None,
        description=(
            "Required only for Bet/Raise: total commitment on this street, not"
            " the increment."
        ),
    )
    street: Street
    sequence: Sequence = Field(
        description=(
            "Unique ordering within the hand; gaps are allowed. Actions are"
            " replayed in ascending order."
        )
    )

    @model_validator(mode="after")
    def validate_amount(self) -> Self:
        needs_amount = self.action_type in (ActionType.BET, ActionType.RAISE)
        if needs_amount != (self.amount_to is not None):
            raise ValueError(
                "amountTo is required for Bet/Raise and must be null for all"
                " other actions."
            )
        return self


FOLD_EXAMPLE = {
    "submissionId": "b2d65d25-8027-41ac-bc0e-5fdc572c9500",
    "dealer": 0,
    "communityCards": [],
    "players": [
        {"player": i, "startingStack": 1000, "cards": cards}
        for i, cards in enumerate(
            [
                ["As", "Ah"],
                ["Ks", "Kh"],
                ["Qs", "Qh"],
                ["Js", "Jh"],
                ["Ts", "Th"],
                ["9s", "9h"],
            ]
        )
    ],
    "actions": [
        {
            "player": p,
            "actionType": "Fold",
            "amountTo": None,
            "street": "Preflop",
            "sequence": i,
        }
        for i, p in enumerate([3, 4, 5, 0, 1])
    ],
}


class HandInput(ApiModel):
    model_config = ConfigDict(json_schema_extra={"examples": [FOLD_EXAMPLE]})
    submission_id: UUID = Field(
        description=(
            "Generate once per completed hand and retain unchanged for"
            " retries."
        )
    )
    dealer: Seat
    community_cards: list[Card] = Field(max_length=5)
    players: list[PlayerInput] = Field(min_length=2, max_length=6)
    actions: list[ActionInput]

    @model_validator(mode="after")
    def validate_hand(self) -> Self:
        seats = [p.player for p in self.players]
        if len(set(seats)) != len(seats):
            raise ValueError(
                "Each participating player must appear exactly once."
            )
        if self.dealer not in seats:
            raise ValueError("The dealer must be a participating player.")
        if sum(p.starting_stack for p in self.players) > MAX_CHIP_SUPPLY:
            raise ValueError(
                "Total chip supply exceeds the JavaScript-safe six-player game"
                " limit."
            )
        if len(self.community_cards) not in (0, 3, 4, 5):
            raise ValueError(
                "Community cards must contain 0, 3, 4, or 5 cards."
            )
        cards = [
            *self.community_cards,
            *(c for p in self.players for c in p.cards),
        ]
        if len(set(cards)) != len(cards):
            raise ValueError(
                "Cards must be unique across all players and the board."
            )
        if len({a.sequence for a in self.actions}) != len(self.actions):
            raise ValueError(
                "Action sequence numbers must be unique within the hand."
            )
        if any(a.player not in seats for a in self.actions):
            raise ValueError(
                "Every action must belong to a participating player."
            )
        return self

    def to_domain(self) -> HandSubmissionDTO:
        return HandSubmissionDTO(
            self.submission_id,
            self.dealer,
            tuple(self.community_cards),
            tuple(
                PlayerHandSubmissionDTO(p.player, p.starting_stack, p.cards)
                for p in sorted(self.players, key=lambda p: p.player)
            ),
            tuple(
                ActionSubmissionDTO(
                    a.player, a.action_type, a.amount_to, a.street, a.sequence
                )
                for a in sorted(self.actions, key=lambda a: a.sequence)
            ),
        )


class PlayerOutput(PlayerInput):
    id: UUID
    hand_id: UUID
    win_loss: int = Field(
        description=(
            "Authoritative net payoff. Ending stack = startingStack + winLoss."
        )
    )
    created_at: datetime
    updated_at: datetime


class ActionOutput(ActionInput):
    id: UUID
    hand_id: UUID
    created_at: datetime
    updated_at: datetime


class HandOutput(ApiModel):
    id: UUID
    submission_id: UUID
    dealer: Player
    community_cards: tuple[Card, ...]
    players: tuple[PlayerOutput, ...]
    actions: tuple[ActionOutput, ...]
    created_at: datetime
    updated_at: datetime


class ErrorOutput(BaseModel):
    detail: str
