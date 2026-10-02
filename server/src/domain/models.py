from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum, StrEnum
from uuid import UUID

MAX_SAFE_INTEGER = 2**53 - 1
MAX_CHIP_SUPPLY = (MAX_SAFE_INTEGER // 6) * 6


class Player(IntEnum):
    P0 = 0
    P1 = 1
    P2 = 2
    P3 = 3
    P4 = 4
    P5 = 5


class ActionType(StrEnum):
    FOLD = "Fold"
    CHECK = "Check"
    CALL = "Call"
    BET = "Bet"
    RAISE = "Raise"
    ALLIN = "Allin"


class Street(StrEnum):
    PREFLOP = "Preflop"
    FLOP = "Flop"
    TURN = "Turn"
    RIVER = "River"


Card = StrEnum(
    "Card",
    {
        f"{rank}{suit}": f"{rank}{suit}"
        for rank in "23456789TJQKA"
        for suit in "cdhs"
    },
)


@dataclass(frozen=True)
class PlayerHandSubmissionDTO:
    player: Player
    starting_stack: int
    cards: tuple[Card, Card]


@dataclass(frozen=True)
class ActionSubmissionDTO:
    player: Player
    action_type: ActionType
    amount_to: int | None
    street: Street
    sequence: int


@dataclass(frozen=True)
class HandSubmissionDTO:
    submission_id: UUID
    dealer: Player
    community_cards: tuple[Card, ...]
    players: tuple[PlayerHandSubmissionDTO, ...]
    actions: tuple[ActionSubmissionDTO, ...]


@dataclass(frozen=True)
class PlayerHand(PlayerHandSubmissionDTO):
    id: UUID
    hand_id: UUID
    win_loss: int
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class Action(ActionSubmissionDTO):
    id: UUID
    hand_id: UUID
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class Hand:
    id: UUID
    submission_id: UUID
    dealer: Player
    community_cards: tuple[Card, ...]
    players: tuple[PlayerHand, ...]
    actions: tuple[Action, ...]
    created_at: datetime
    updated_at: datetime

    def submission(self) -> HandSubmissionDTO:
        return HandSubmissionDTO(
            self.submission_id,
            self.dealer,
            self.community_cards,
            tuple(
                PlayerHandSubmissionDTO(p.player, p.starting_stack, p.cards)
                for p in self.players
            ),
            tuple(
                ActionSubmissionDTO(
                    a.player, a.action_type, a.amount_to, a.street, a.sequence
                )
                for a in self.actions
            ),
        )
