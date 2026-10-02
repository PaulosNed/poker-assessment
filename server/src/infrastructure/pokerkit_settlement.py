from pokerkit import Automation, NoLimitTexasHoldem, State

from src.domain.errors import InvalidHand
from src.domain.models import (
    ActionType,
    HandSubmissionDTO,
    Player,
    Street,
    ActionSubmissionDTO,
)


class PokerKitSettlement:
    def settle(self, submission: HandSubmissionDTO) -> dict[Player, int]:
        # Position zero is immediately left of the dealer among active seats.
        # PokerKit reverses the blinds for heads-up: index 0 is BB,
        # index 1 is dealer/SB.
        players = sorted(
            submission.players,
            key=lambda p: (p.player - submission.dealer - 1) % 6,
        )
        state = NoLimitTexasHoldem.create_state(
            (
                Automation.ANTE_POSTING,
                Automation.BLIND_OR_STRADDLE_POSTING,
                Automation.BET_COLLECTION,
                Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
                Automation.HAND_KILLING,
                Automation.CHIPS_PUSHING,
                Automation.CHIPS_PULLING,
            ),
            True,
            0,
            (20, 40),
            40,
            tuple(p.starting_stack for p in players),
            len(players),
        )
        context = "hole cards"
        try:
            for index, player in enumerate(players):
                state.deal_hole("".join(player.cards), player_index=index)

            board_offset = 0
            actions = iter(submission.actions)
            while state.status:
                if state.can_burn_card():
                    context = "community cards"
                    count = 3 if board_offset == 0 else 1
                    cards = submission.community_cards[
                        board_offset:board_offset + count
                    ]
                    if len(cards) != count:
                        raise InvalidHand(
                            "Missing community cards for the next street."
                        )
                    state.burn_card("??")
                    state.deal_board("".join(cards))
                    board_offset += count
                    continue

                if state.actor_index is None:
                    raise RuntimeError(
                        "PokerKit replay stopped without an actor or a"
                        " board-dealing transition."
                    )
                action = next(actions, None)
                if action is None:
                    raise InvalidHand(
                        "The hand is incomplete: a player decision is still"
                        " required."
                    )
                context = f"action sequence {action.sequence}"
                if players[state.actor_index].player != action.player:
                    raise InvalidHand(f"Wrong actor at {context}.")
                if tuple(Street)[state.street_index] != action.street:
                    raise InvalidHand(f"Wrong street at {context}.")
                self._apply(state, action)

            if next(actions, None) is not None:
                raise InvalidHand(
                    "Actions remain after the hand has already completed."
                )
            if board_offset != len(submission.community_cards):
                raise InvalidHand(
                    "Community cards remain after the hand has already"
                    " completed."
                )
        except ValueError as error:
            raise InvalidHand(f"Invalid {context}: {error}") from error

        if sum(state.payoffs) != 0:
            raise RuntimeError("PokerKit settlement did not conserve chips.")
        return {
            player.player: state.payoffs[i] for i, player in enumerate(players)
        }

    @staticmethod
    def _apply(state: State, action: ActionSubmissionDTO) -> None:
        match action.action_type:
            case ActionType.FOLD:
                state.fold()
            case ActionType.CHECK:
                if state.checking_or_calling_amount != 0:
                    raise InvalidHand(
                        "Check is illegal while chips are required to call."
                    )
                state.check_or_call()
            case ActionType.CALL:
                if not state.checking_or_calling_amount:
                    raise InvalidHand(
                        "Call is illegal when there is nothing to call."
                    )
                state.check_or_call()
            case ActionType.BET | ActionType.RAISE:
                if (action.action_type == ActionType.BET) != (
                    max(state.bets) == 0
                ):
                    raise InvalidHand(
                        "Use Bet to open betting and Raise when a wager"
                        " already exists."
                    )
                # PokerKit enforces bounds and reopening, including
                # short all-in exceptions.
                state.complete_bet_or_raise_to(action.amount_to)
            case ActionType.ALLIN:
                if (
                    state.checking_or_calling_amount
                    == state.stacks[state.actor_index]
                ):
                    state.check_or_call()
                else:
                    amount = state.max_completion_betting_or_raising_to_amount
                    if amount is None:
                        raise InvalidHand(
                            "Allin cannot raise in the current betting state."
                        )
                    state.complete_bet_or_raise_to(amount)
