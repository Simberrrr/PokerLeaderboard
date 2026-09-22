CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX players_name_lower_unique ON players (LOWER(name));

CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    played_at TIMESTAMP NOT NULL
);

CREATE TABLE player_results (
    game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INT NOT NULL REFERENCES players(id),
    buy_in NUMERIC(10, 2) NOT NULL,
    cash_out NUMERIC(10, 2) NOT NULL
);
