from typing import Protocol

from src.domain.errors import SubmissionConflict
from src.domain.models import Hand, HandSubmissionDTO, Player
from src.repositories.hands import HandRepository


class HandSettlement(Protocol):
    def settle(self, submission: HandSubmissionDTO) -> dict[Player, int]: ...


class HandService:
    def __init__(self, repository: HandRepository, settlement: HandSettlement):
        self.repository = repository
        self.settlement = settlement

    def submit(self, submission: HandSubmissionDTO) -> tuple[Hand, bool]:
        existing = self.repository.find_by_submission(submission.submission_id)
        if existing is not None:
            if existing.submission() != submission:
                raise SubmissionConflict(
                    "submissionId already belongs to a different hand."
                )
            return existing, False

        payoffs = self.settlement.settle(submission)
        return self.repository.save(submission, payoffs)

    def list(self) -> list[Hand]:
        return self.repository.list()
