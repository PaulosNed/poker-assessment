CREATE TABLE IF NOT EXISTS hands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE,
    dealer SMALLINT NOT NULL CHECK (dealer BETWEEN 0 AND 5),
    community_cards TEXT[] NOT NULL CHECK (cardinality(community_cards) IN (0, 3, 4, 5)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_hands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hand_id UUID NOT NULL REFERENCES hands(id),
    player SMALLINT NOT NULL CHECK (player BETWEEN 0 AND 5),
    starting_stack BIGINT NOT NULL CHECK (starting_stack > 0),
    cards TEXT[] NOT NULL CHECK (cardinality(cards) = 2),
    win_loss BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (hand_id, player),
    CHECK (starting_stack + win_loss >= 0)
);

CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hand_id UUID NOT NULL REFERENCES hands(id),
    player SMALLINT NOT NULL CHECK (player BETWEEN 0 AND 5),
    action_type TEXT NOT NULL CHECK (action_type IN ('Fold', 'Check', 'Call', 'Bet', 'Raise', 'Allin')),
    amount_to BIGINT,
    street TEXT NOT NULL CHECK (street IN ('Preflop', 'Flop', 'Turn', 'River')),
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (hand_id, sequence),
    CHECK ((action_type IN ('Bet', 'Raise') AND amount_to IS NOT NULL AND amount_to > 0)
        OR (action_type NOT IN ('Bet', 'Raise') AND amount_to IS NULL))
);

CREATE INDEX IF NOT EXISTS hands_newest ON hands (created_at DESC, id DESC);

-- Upgrade existing initialized tables without rewriting saved IDs or dates.
ALTER TABLE hands
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE player_hands
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE actions
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
