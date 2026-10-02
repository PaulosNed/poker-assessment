from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from uuid import uuid4

import psycopg

ROUTE = "/api/v1/hands"


def hand(players, actions, board=(), dealer=0):
    return {
        "submissionId": str(uuid4()),
        "dealer": dealer,
        "communityCards": list(board),
        "players": [
            {"player": seat, "startingStack": stack, "cards": cards.split()}
            for seat, stack, cards in players
        ],
        "actions": [
            {
                "sequence": i,
                "player": seat,
                "street": street,
                "actionType": kind,
                "amountTo": amount,
            }
            for i, (seat, street, kind, amount) in enumerate(actions)
        ],
    }


def fold_hand(dealer=0):
    return hand(
        [
            (i, 1000, cards)
            for i, cards in enumerate(
                ["As Ah", "Ks Kh", "Qs Qh", "Js Jh", "Ts Th", "9s 9h"]
            )
        ],
        [
            ((dealer + offset) % 6, "Preflop", "Fold", None)
            for offset in [3, 4, 5, 0, 1]
        ],
        dealer=dealer,
    )


def post(client, payload):
    response = client.post(ROUTE, json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert sum(p["winLoss"] for p in body["players"]) == 0
    assert all(p["startingStack"] + p["winLoss"] >= 0 for p in body["players"])
    assert "startingStack" not in body
    return body


def payoffs(body):
    return {p["player"]: p["winLoss"] for p in body["players"]}


def counts(database_url):
    with psycopg.connect(database_url) as connection:
        return tuple(
            connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in ("hands", "player_hands", "actions")
        )


def test_empty_history_and_interactive_documentation(api):
    client, _, _ = api
    assert client.get(ROUTE).json() == []
    docs = client.get("/docs")
    assert docs.status_code == 200 and "SwaggerUIBundle" in docs.text
    schema = client.get("/openapi.json").json()
    assert set(schema["paths"][ROUTE]) == {"get", "post"}
    assert (
        "startingStack"
        not in schema["components"]["schemas"]["HandOutput"]["properties"]
    )
    assert (
        "startingStack"
        in schema["components"]["schemas"]["PlayerOutput"]["properties"]
    )
    # The documentation's example is actually executable, not merely
    # illustrative.
    example = deepcopy(
        schema["components"]["schemas"]["HandInput"]["examples"][0]
    )
    example["submissionId"] = str(uuid4())
    post(client, example)


def test_fold_settlement_rotation_persistence_and_newest_first(api):
    client, database_url, _ = api
    first = post(client, fold_hand())
    assert payoffs(first) == {0: 0, 1: -20, 2: 20, 3: 0, 4: 0, 5: 0}
    second = post(client, fold_hand(dealer=3))
    assert payoffs(second) == {0: 0, 1: 0, 2: 0, 3: 0, 4: -20, 5: 20}
    assert client.get(ROUTE).json() == [second, first]
    assert counts(database_url) == (2, 12, 10)


def test_unequal_stacks_side_pots_unmatched_return_and_allin_runout(api):
    client, _, _ = api
    body = post(
        client,
        hand(
            [(0, 100, "As Ah"), (2, 200, "Ks Kh"), (5, 300, "Qs Qh")],
            [
                (5, "Preflop", "Allin", None),
                (0, "Preflop", "Call", None),
                (2, "Preflop", "Allin", None),
            ],
            ["2c", "3d", "7h", "8s", "9c"],
            dealer=5,
        ),
    )
    assert payoffs(body) == {0: 200, 2: 0, 5: -200}
    assert {p["player"] for p in body["players"]} == {0, 2, 5}


def test_heads_up_all_streets_and_split_pot(api):
    client, _, _ = api
    actions = [(1, "Preflop", "Call", None), (4, "Preflop", "Check", None)]
    for street in ["Flop", "Turn", "River"]:
        actions += [(4, street, "Check", None), (1, street, "Check", None)]
    result = post(
        client,
        hand(
            [(1, 100, "2c 3c"), (4, 200, "4d 5d")],
            actions,
            ["Th", "Jh", "Qh", "Kh", "Ah"],
            dealer=1,
        ),
    )
    assert payoffs(result) == {1: 0, 4: 0}


def test_short_blinds_complete_without_player_actions(api):
    client, _, _ = api
    result = post(
        client,
        hand(
            [(1, 10, "As Ah"), (4, 15, "Ks Kh")],
            [],
            ["2c", "3d", "7h", "8s", "9c"],
            dealer=1,
        ),
    )
    assert payoffs(result) == {1: 10, 4: -10}


def short_raise_hand():
    # BB's 130 shove is a short raise over the dealer's raise to 100.
    return hand(
        [(0, 500, "As Ah"), (2, 130, "Ks Kh"), (5, 500, "Qs Qh")],
        [
            (5, "Preflop", "Raise", 100),
            (0, "Preflop", "Call", None),
            (2, "Preflop", "Allin", None),
            (5, "Preflop", "Call", None),
            (0, "Preflop", "Call", None),
            (0, "Flop", "Bet", 40),
            (5, "Flop", "Fold", None),
        ],
        ["2c", "3d", "7h", "8s", "9c"],
        dealer=5,
    )


def test_short_raise_calls_bet_and_automatic_runout_with_one_funded_player(
    api,
):
    result = post(api[0], short_raise_hand())
    assert payoffs(result) == {0: 260, 2: -130, 5: -130}


def test_odd_chip_goes_to_first_winner_left_of_dealer(api):
    result = post(
        api[0],
        hand(
            [(0, 41, "As Kd"), (2, 41, "Ac Ks"), (5, 41, "Qs Qh")],
            [
                (5, "Preflop", "Allin", None),
                (0, "Preflop", "Allin", None),
                (2, "Preflop", "Call", None),
            ],
            ["Ah", "7c", "8d", "9h", "2s"],
            dealer=5,
        ),
    )
    assert payoffs(result) == {0: 21, 2: 20, 5: -41}


def test_full_raise_reopens_action_and_incomplete_board_can_end_by_folds(api):
    result = post(
        api[0],
        hand(
            [(0, 500, "As Ah"), (2, 500, "Ks Kh"), (5, 500, "Qs Qh")],
            [
                (5, "Preflop", "Raise", 100),
                (0, "Preflop", "Raise", 160),
                (2, "Preflop", "Fold", None),
                (5, "Preflop", "Raise", 220),
                (0, "Preflop", "Call", None),
                (0, "Flop", "Check", None),
                (5, "Flop", "Bet", 40),
                (0, "Flop", "Fold", None),
            ],
            ["2c", "3d", "7h"],
            dealer=5,
        ),
    )
    assert payoffs(result) == {0: -220, 2: -40, 5: 260}


def test_concurrent_idempotent_retries_and_normalized_array_order(api):
    client, database_url, _ = api
    payload = fold_hand()
    with ThreadPoolExecutor(max_workers=6) as pool:
        responses = list(
            pool.map(lambda _: client.post(ROUTE, json=payload), range(6))
        )
    assert sorted(r.status_code for r in responses) == [200] * 5 + [201]
    assert all(r.json() == responses[0].json() for r in responses)
    payload["players"].reverse()
    payload["actions"].reverse()
    retried = client.post(ROUTE, json=payload)
    assert retried.status_code == 200
    assert retried.json() == responses[0].json()
    assert counts(database_url) == (1, 6, 5)


# Five realistic failure scenarios: bad payload, illegal replay,
# incomplete hand,
# conflicting retry, and database failure during a multi-table transaction.
def test_duplicate_cards_are_rejected_before_persistence(api):
    client, database_url, log_path = api
    payload = fold_hand()
    payload["players"][1]["cards"][0] = "As"
    response = client.post(ROUTE, json=payload)
    assert response.status_code == 422 and "unique" in response.text
    assert counts(database_url) == (0, 0, 0)
    assert "Request validation failed" in log_path.read_text()


def test_short_allin_does_not_reopen_raising(api):
    client, database_url, log_path = api
    payload = short_raise_hand()
    payload["actions"][3].update(actionType="Raise", amountTo=200)
    response = client.post(ROUTE, json=payload)
    assert response.status_code == 422, response.text
    assert "raise" in response.text.lower()
    assert counts(database_url) == (0, 0, 0)
    assert "Hand submission rejected" in log_path.read_text()
    assert "Traceback" in log_path.read_text()


def test_incomplete_hand_is_not_saved(api):
    client, database_url, _ = api
    payload = fold_hand()
    payload["actions"].pop()
    response = client.post(ROUTE, json=payload)
    assert response.status_code == 422 and "incomplete" in response.text
    assert counts(database_url) == (0, 0, 0)


def test_conflicting_submission_does_not_modify_original(api):
    client, database_url, _ = api
    payload = fold_hand()
    original = post(client, payload)
    payload["players"][0]["startingStack"] += 1
    response = client.post(ROUTE, json=payload)
    assert response.status_code == 409
    assert client.get(ROUTE).json() == [original]
    assert counts(database_url) == (1, 6, 5)


def test_database_failure_rolls_back_whole_hand_and_allows_retry(api):
    client, database_url, log_path = api
    payload = fold_hand()
    with psycopg.connect(database_url) as connection:
        connection.execute(
            (
                'CREATE FUNCTION reject_test_action() RETURNS '
                'trigger LANGUAGE plpgsql AS $$\n            BEGIN'
                " RAISE EXCEPTION 'deliberate test action insert "
                "failure'; END $$"
            )
        )
        connection.execute(
            "CREATE TRIGGER reject_test_action BEFORE INSERT ON actions FOR"
            " EACH ROW EXECUTE FUNCTION reject_test_action()"
        )
    try:
        response = client.post(ROUTE, json=payload)
        assert response.status_code == 500
        assert "could not be completed" in response.text
        assert "deliberate" not in response.text
        assert counts(database_url) == (0, 0, 0)
        logs = log_path.read_text()
        assert (
            "deliberate test action insert failure" in logs
            and "Traceback" in logs
        )
    finally:
        with psycopg.connect(database_url) as connection:
            connection.execute("DROP TRIGGER reject_test_action ON actions")
            connection.execute("DROP FUNCTION reject_test_action()")
    post(client, payload)
    assert counts(database_url) == (1, 6, 5)
