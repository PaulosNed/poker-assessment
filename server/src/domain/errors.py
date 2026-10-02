class InvalidHand(ValueError):
    """
    The submitted cards or action sequence do not describe a completed
    legal hand.
    """


class SubmissionConflict(ValueError):
    """A submission ID has already been used for a different hand."""
