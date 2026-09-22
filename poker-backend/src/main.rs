use axum::{extract::{Path, State}, http::StatusCode, Json, routing::{get, post, patch}, Router};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use sqlx::postgres::PgPoolOptions;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use dotenvy::dotenv;
use std::env;
use tower_http::cors::{CorsLayer, AllowOrigin,Any};
use tower_http::trace::TraceLayer;
use axum::http::{ Method};

#[derive(FromRow, Serialize)]
pub struct Player {
    id: i32,
    name: String,
    created_at: NaiveDateTime,
}

#[derive(FromRow, Serialize)]
struct PlayerStats {
    id: i32,
    name: String,
    profit: Decimal,
    games: i64,
}

#[derive(Deserialize)]
struct CreatePlayer {
    name: String,
}

#[derive(Deserialize)]
struct CreateGameRequest {
    results: Vec<CreatePlayerResult>,
}

#[derive(Deserialize)]
struct CreatePlayerResult {
    player_id: i32,
    buy_in: Decimal,
    cash_out: Decimal,
}

#[derive(Deserialize)]
struct UpdateGameRequest {
    played_at: Option<NaiveDateTime>,
    results: Option<Vec<CreatePlayerResult>>,
}

#[derive(Serialize)]
struct CreateGameResponse {
    id: i32,
}

#[derive(Serialize)]
struct GamePlayerResult {
    player_id: i32,
    player_name: String,
    buy_in: Decimal,
    cash_out: Decimal,
}

#[derive(Serialize)]
struct GameSummary {
    id: i32,
    played_at: NaiveDateTime,
    results: Vec<GamePlayerResult>,
}

#[derive(Serialize)]
struct PlayerDetail {
    id: i32,
    name: String,
    profit: Decimal,
    games: usize,
    game_ids: Vec<i32>,
}

#[derive(Deserialize)]
struct AddBuyInRequest {
    amount: Decimal,
}

#[derive(Deserialize)]
struct SetCashOutRequest {
    amount: Decimal,
}

async fn health_check() -> &'static str {
    "Server is running"
}

async fn leaderboard(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<PlayerStats>>, String> {
    let rows = sqlx::query_as!(
        PlayerStats,
        r#"
        SELECT
            p.id,
            p.name,
            COALESCE(SUM(pr.cash_out - pr.buy_in), 0) AS "profit!: Decimal",
            COUNT(DISTINCT pr.game_id)::bigint          AS "games!: i64"
        FROM players p
        LEFT JOIN player_results pr ON pr.player_id = p.id
        GROUP BY p.id, p.name
        ORDER BY COALESCE(SUM(pr.cash_out - pr.buy_in), 0) DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "GET /leaderboard failed");
        e.to_string()
    })?;

    tracing::info!(count = rows.len(), "GET /leaderboard succeeded");
    Ok(Json(rows))
}

async fn add_player(
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePlayer>,
) -> Result<Json<Player>, (StatusCode, String)> {
    let player = create_player(&pool, payload.name)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.code().as_deref() == Some("23505") {
                    tracing::info!("POST /player failed: duplicate name");
                    return (
                        StatusCode::CONFLICT,
                        "A player with this name already exists".to_string(),
                    );
                }
            }
            tracing::error!(error = %e, "POST /player failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    tracing::info!(player_id = player.id, "POST /player succeeded");
    Ok(Json(player))
}

async fn list_players(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Player>>, String> {
    let players = sqlx::query_as!(
        Player,
        r#"
        SELECT id, name, created_at AS "created_at!: NaiveDateTime"
        FROM players
        ORDER BY name
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "GET /players failed");
        e.to_string()
    })?;

    tracing::info!(count = players.len(), "GET /players succeeded");
    Ok(Json(players))
}

async fn get_player(
    State(pool): State<PgPool>,
    Path(player_id): Path<i32>,
) -> Result<Json<PlayerDetail>, (StatusCode, String)> {
    let row = sqlx::query!(
        r#"
        SELECT
            p.id,
            p.name,
            COALESCE(SUM(pr.cash_out - pr.buy_in), 0) AS "profit!: Decimal",
            COALESCE(
                ARRAY_AGG(pr.game_id) FILTER (WHERE pr.game_id IS NOT NULL),
                '{}'
            ) AS "game_ids!: Vec<i32>"
        FROM players p
        LEFT JOIN player_results pr ON pr.player_id = p.id
        WHERE p.id = $1
        GROUP BY p.id, p.name
        "#,
        player_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, player_id, "GET /players/{{id}} failed");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| {
        tracing::info!(player_id, "GET /players/{{id}}: not found");
        (StatusCode::NOT_FOUND, "Player not found".to_string())
    })?;

    tracing::info!(player_id, "GET /players/{{id}} succeeded");
    Ok(Json(PlayerDetail {
        id: row.id,
        name: row.name,
        profit: row.profit,
        games: row.game_ids.len(),
        game_ids: row.game_ids,
    }))
}

pub async fn create_player(
    pool: &PgPool,
    name: String,
) -> Result<Player, sqlx::Error> {
    sqlx::query_as!(
        Player,
        r#"
        INSERT INTO players (name)
        VALUES ($1)
        RETURNING id, name, created_at AS "created_at!: NaiveDateTime"
        "#,
        name
    )
    .fetch_one(pool)
    .await
}

async fn add_game(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateGameRequest>,
) -> Result<Json<CreateGameResponse>,String>{
    let result_count = payload.results.len();
    let response = create_game(&pool, payload)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "POST /game failed");
            e.to_string()
        })?;

    tracing::info!(game_id = response.id, results = result_count, "POST /game succeeded");
    Ok(Json(response))
}

async fn create_game(
    pool: &PgPool,
    payload: CreateGameRequest,
) -> Result<CreateGameResponse, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // 1. Insert game
    let game = sqlx::query!(
        r#"
        INSERT INTO games (played_at)
        VALUES (NOW())
        RETURNING id
        "#
    )
    .fetch_one(&mut *tx)
    .await?;
    let game_id = game.id;

    // 2. Loop through every player in payload.results
    for player in payload.results {
        insert_player_result(
            &mut *tx,
            game_id,
            player.player_id,
            player.buy_in,
            player.cash_out,
        )
        .await?;
    }

    // 3. Commit and return the game id
    tx.commit().await?;
    Ok(CreateGameResponse { id: game_id })
}

async fn insert_player_result(
    tx: &mut sqlx::PgConnection,
    game_id: i32,
    player_id: i32,
    buy_in: Decimal,
    cash_out: Decimal,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO player_results (
            game_id,
            player_id,
            buy_in,
            cash_out
        )
        VALUES ($1, $2, $3, $4)
        "#,
        game_id,
        player_id,
        buy_in,
        cash_out,
    )
    .execute(tx)
    .await?;
    Ok(())
}


async fn list_games(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<GameSummary>>, String> {
    let games = sqlx::query!(
        r#"
        SELECT id, played_at AS "played_at!: NaiveDateTime"
        FROM games
        ORDER BY played_at DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "GET /games failed (games query)");
        e.to_string()
    })?;

    let results = sqlx::query!(
        r#"
        SELECT
            pr.game_id,
            pr.player_id,
            p.name AS player_name,
            pr.buy_in,
            pr.cash_out
        FROM player_results pr
        JOIN players p ON p.id = pr.player_id
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "GET /games failed (results query)");
        e.to_string()
    })?;

    let summaries: Vec<GameSummary> = games
        .into_iter()
        .map(|game| {
            let game_results = results
                .iter()
                .filter(|r| r.game_id == game.id)
                .map(|r| GamePlayerResult {
                    player_id: r.player_id,
                    player_name: r.player_name.clone(),
                    buy_in: r.buy_in,
                    cash_out: r.cash_out,
                })
                .collect();

            GameSummary {
                id: game.id,
                played_at: game.played_at,
                results: game_results,
            }
        })
        .collect();

    tracing::info!(count = summaries.len(), "GET /games succeeded");
    Ok(Json(summaries))
}

async fn fetch_game_summary(
    pool: &PgPool,
    game_id: i32,
) -> Result<Option<GameSummary>, sqlx::Error> {
    let game = sqlx::query!(
        r#"
        SELECT id, played_at AS "played_at!: NaiveDateTime"
        FROM games
        WHERE id = $1
        "#,
        game_id
    )
    .fetch_optional(pool)
    .await?;

    let Some(game) = game else {
        return Ok(None);
    };

    let results = sqlx::query!(
        r#"
        SELECT
            pr.player_id,
            p.name AS player_name,
            pr.buy_in,
            pr.cash_out
        FROM player_results pr
        JOIN players p ON p.id = pr.player_id
        WHERE pr.game_id = $1
        "#,
        game_id
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| GamePlayerResult {
        player_id: r.player_id,
        player_name: r.player_name,
        buy_in: r.buy_in,
        cash_out: r.cash_out,
    })
    .collect();

    Ok(Some(GameSummary {
        id: game.id,
        played_at: game.played_at,
        results,
    }))
}

async fn get_game(
    State(pool): State<PgPool>,
    Path(game_id): Path<i32>,
) -> Result<Json<GameSummary>, (StatusCode, String)> {
    let summary = fetch_game_summary(&pool, game_id)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, game_id, "GET /games/{{id}} failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?
        .ok_or_else(|| {
            tracing::info!(game_id, "GET /games/{{id}}: not found");
            (StatusCode::NOT_FOUND, "Game not found".to_string())
        })?;

    tracing::info!(game_id, "GET /games/{{id}} succeeded");
    Ok(Json(summary))
}

async fn patch_game(
    State(pool): State<PgPool>,
    Path(game_id): Path<i32>,
    Json(payload): Json<UpdateGameRequest>,
) -> Result<Json<GameSummary>, (StatusCode, String)> {
    if payload.played_at.is_none() && payload.results.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Provide at least one of played_at or results".to_string(),
        ));
    }

    let mut tx = pool.begin().await.map_err(|e| {
        tracing::error!(error = %e, game_id, "PATCH /games/{{id}} failed to start transaction");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    // Update played_at (no-op if not provided) and confirm the game exists.
    let updated = sqlx::query!(
        r#"
        UPDATE games
        SET played_at = COALESCE($2, played_at)
        WHERE id = $1
        RETURNING id
        "#,
        game_id,
        payload.played_at,
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, game_id, "PATCH /games/{{id}} failed (update game)");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    if updated.is_none() {
        tracing::info!(game_id, "PATCH /games/{{id}}: not found");
        return Err((StatusCode::NOT_FOUND, "Game not found".to_string()));
    }

    // Replace results entirely if a new set was provided.
    if let Some(results) = payload.results {
        sqlx::query!(
            r#"DELETE FROM player_results WHERE game_id = $1"#,
            game_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, game_id, "PATCH /games/{{id}} failed (clear results)");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

        for player in results {
            insert_player_result(
                &mut *tx,
                game_id,
                player.player_id,
                player.buy_in,
                player.cash_out,
            )
            .await
            .map_err(|e| {
                tracing::error!(error = %e, game_id, "PATCH /games/{{id}} failed (insert results)");
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;
        }
    }

    tx.commit().await.map_err(|e| {
        tracing::error!(error = %e, game_id, "PATCH /games/{{id}} failed to commit");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let summary = fetch_game_summary(&pool, game_id)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, game_id, "PATCH /games/{{id}} failed to refetch");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?
        .ok_or_else(|| {
            (StatusCode::INTERNAL_SERVER_ERROR, "Game vanished after update".to_string())
        })?;

    tracing::info!(game_id, "PATCH /games/{{id}} succeeded");
    Ok(Json(summary))
}

async fn add_buy_in(
    State(pool): State<PgPool>,
    Path((game_id, player_id)): Path<(i32, i32)>,
    Json(payload): Json<AddBuyInRequest>,
) -> Result<Json<GamePlayerResult>, (StatusCode, String)> {
    let updated = sqlx::query!(
        r#"
        UPDATE player_results pr
        SET buy_in = pr.buy_in + $3
        FROM players p
        WHERE pr.game_id = $1
          AND pr.player_id = $2
          AND p.id = pr.player_id
        RETURNING pr.player_id, p.name AS player_name, pr.buy_in, pr.cash_out
        "#,
        game_id,
        player_id,
        payload.amount,
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, game_id, player_id, "PATCH /games/{{game_id}}/players/{{player_id}}/buy-in failed");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| {
        tracing::info!(game_id, player_id, "PATCH /games/{{game_id}}/players/{{player_id}}/buy-in: not found");
        (StatusCode::NOT_FOUND, "Player result not found for this game".to_string())
    })?;

    tracing::info!(
        game_id,
        player_id,
        amount = %payload.amount,
        new_buy_in = %updated.buy_in,
        "PATCH /games/{{game_id}}/players/{{player_id}}/buy-in succeeded"
    );

    Ok(Json(GamePlayerResult {
        player_id: updated.player_id,
        player_name: updated.player_name,
        buy_in: updated.buy_in,
        cash_out: updated.cash_out,
    }))
}

async fn set_cash_out(
    State(pool): State<PgPool>,
    Path((game_id, player_id)): Path<(i32, i32)>,
    Json(payload): Json<SetCashOutRequest>,
) -> Result<Json<GamePlayerResult>, (StatusCode, String)> {
    let updated = sqlx::query!(
        r#"
        UPDATE player_results pr
        SET cash_out = $3
        FROM players p
        WHERE pr.game_id = $1
          AND pr.player_id = $2
          AND p.id = pr.player_id
        RETURNING pr.player_id, p.name AS player_name, pr.buy_in, pr.cash_out
        "#,
        game_id,
        player_id,
        payload.amount,
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, game_id, player_id, "PATCH /game/{{game_id}}/players/{{player_id}}/cash-out failed");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| {
        tracing::info!(game_id, player_id, "PATCH /game/{{game_id}}/players/{{player_id}}/cash-out: not found");
        (StatusCode::NOT_FOUND, "Player result not found for this game".to_string())
    })?;

    tracing::info!(
        game_id,
        player_id,
        cash_out = %updated.cash_out,
        "PATCH /game/{{game_id}}/players/{{player_id}}/cash-out succeeded"
    );

    Ok(Json(GamePlayerResult {
        player_id: updated.player_id,
        player_name: updated.player_name,
        buy_in: updated.buy_in,
        cash_out: updated.cash_out,
    }))
}

async fn delete_game(
    State(pool): State<PgPool>,
    Path(game_id): Path<i32>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!(
        r#"
        DELETE FROM games
        WHERE id = $1
        "#,
        game_id
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, game_id, "DELETE /games/{{id}} failed");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    if result.rows_affected() == 0 {
        tracing::info!(game_id, "DELETE /games/{{id}}: not found");
        return Err((StatusCode::NOT_FOUND, "Game not found".to_string()));
    }

    tracing::info!(game_id, "DELETE /games/{{id}} succeeded");
    Ok(StatusCode::NO_CONTENT)
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .init();

    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .unwrap();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            let o = origin.as_bytes();
            o == b"http://localhost:3000" || o == b"https://poker-leaderboard-weld.vercel.app"
        }))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE, Method::OPTIONS,])
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(health_check))
        .route("/leaderboard", get(leaderboard))
        .route("/player", post(add_player))
        .route("/players", get(list_players))
        .route("/players/{id}", get(get_player))
        .route("/game", post(add_game))
        .route("/games", get(list_games))
        .route("/game/{id}", get(get_game).delete(delete_game).patch(patch_game))
        .route("/game/{game_id}/players/{player_id}/buy-in", patch(add_buy_in))
        .route("/game/{game_id}/players/{player_id}/cash-out", patch(set_cash_out))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(pool);

    let port = env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3001);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .unwrap();

    println!("Listening on port {port}");

    axum::serve(listener, app).await.unwrap();
}