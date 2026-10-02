from __future__ import annotations

from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from src.domain.errors import SubmissionConflict
from src.domain.models import (
    Action,
    ActionType,
    Card,
    Hand,
    HandSubmissionDTO,
    Player,
    PlayerHand,
    Street,
)


class PostgresHandRepository:
    def __init__(self, database_url: str):
        self.database_url = database_url

    def find_by_submission(self, submission_id: UUID) -> Hand | None:
        with psycopg.connect(
            self.database_url, row_factory=dict_row
        ) as connection:
            rows = connection.execute(
                "SELECT * FROM hands WHERE submission_id = %s",
                (submission_id,),
            ).fetchall()
            return self._load(connection, rows)[0] if rows else None

    def list(self) -> list[Hand]:
        with psycopg.connect(
            self.database_url, row_factory=dict_row
        ) as connection:
            rows = connection.execute(
                "SELECT * FROM hands ORDER BY created_at DESC, id DESC"
            ).fetchall()
            return self._load(connection, rows)

    def save(
        self, submission: HandSubmissionDTO, payoffs: dict[Player, int]
    ) -> tuple[Hand, bool]:
        with psycopg.connect(
            self.database_url, row_factory=dict_row
        ) as connection:
            inserted = connection.execute(
                """INSERT INTO hands (submission_id, dealer, community_cards)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (submission_id) DO NOTHING RETURNING *""",
                (
                    submission.submission_id,
                    int(submission.dealer),
                    list(submission.community_cards),
                ),
            ).fetchone()
            if inserted is None:
                # The unique constraint waits for the concurrent transaction.
                # READ COMMITTED then sees its committed aggregate.
                rows = connection.execute(
                    "SELECT * FROM hands WHERE submission_id = %s",
                    (submission.submission_id,),
                ).fetchall()
                existing = self._load(connection, rows)[0]
                if existing.submission() != submission:
                    raise SubmissionConflict(
                        "submissionId already belongs to a different hand."
                    )
                return existing, False

            hand_id = inserted["id"]
            with connection.cursor() as cursor:
                cursor.executemany(
                    """INSERT INTO player_hands
                       (hand_id, player, starting_stack, cards, win_loss)
                       VALUES (%s, %s, %s, %s, %s)""",
                    [
                        (
                            hand_id,
                            int(p.player),
                            p.starting_stack,
                            list(p.cards),
                            payoffs[p.player],
                        )
                        for p in submission.players
                    ],
                )
                cursor.executemany(
                    """INSERT INTO actions
                       (hand_id, player, action_type, amount_to, street,
                        sequence)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    [
                        (
                            hand_id,
                            int(a.player),
                            a.action_type.value,
                            a.amount_to,
                            a.street.value,
                            a.sequence,
                        )
                        for a in submission.actions
                    ],
                )
            hand = self._load(connection, [inserted])[0]
        # Commit before returning database-generated IDs and timestamps.
        return hand, True

    @staticmethod
    def _load(connection: psycopg.Connection, rows: list[dict]) -> list[Hand]:
        if not rows:
            return []
        ids = [row["id"] for row in rows]
        players = {id_: [] for id_ in ids}
        actions = {id_: [] for id_ in ids}
        for row in connection.execute(
            "SELECT * FROM player_hands WHERE hand_id = ANY(%s) ORDER BY"
            " player",
            (ids,),
        ):
            players[row["hand_id"]].append(
                PlayerHand(
                    **{
                        **row,
                        "player": Player(row["player"]),
                        "cards": tuple(Card(c) for c in row["cards"]),
                    }
                )
            )
        for row in connection.execute(
            "SELECT * FROM actions WHERE hand_id = ANY(%s) ORDER BY sequence",
            (ids,),
        ):
            actions[row["hand_id"]].append(
                Action(
                    **{
                        **row,
                        "player": Player(row["player"]),
                        "action_type": ActionType(row["action_type"]),
                        "street": Street(row["street"]),
                    }
                )
            )
        return [
            Hand(
                **{
                    **row,
                    "dealer": Player(row["dealer"]),
                    "community_cards": tuple(
                        Card(c) for c in row["community_cards"]
                    ),
                    "players": tuple(players[row["id"]]),
                    "actions": tuple(actions[row["id"]]),
                }
            )
            for row in rows
        ]
