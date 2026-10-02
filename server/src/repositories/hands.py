from typing import Protocol
from uuid import UUID

from src.domain.models import Hand, HandSubmissionDTO, Player


class HandRepository(Protocol):
    def find_by_submission(self, submission_id: UUID) -> Hand | None: ...

    def save(
        self, submission: HandSubmissionDTO, payoffs: dict[Player, int]
    ) -> tuple[Hand, bool]:
        """
        Atomically save the aggregate, or return its identical
        concurrent submission.
        """
        ...

    def list(self) -> list[Hand]: ...
