use axum::{extract::State, Json, routing::{get, post}, Router};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use sqlx::postgres::PgPoolOptions;
use chrono::NaiveDateTime;
use dotenvy::dotenv;
use std::env;

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
    profit: i64,
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
    buy_in: i32,
    cash_out: i32,
}

#[derive(Serialize)]
struct CreateGameResponse {
    id: i32,
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
            COALESCE(SUM(pr.cash_out - pr.buy_in), 0) AS "profit!: i64",
            COUNT(DISTINCT pr.game_id)::bigint          AS "games!: i64"
        FROM players p
        LEFT JOIN player_results pr ON pr.player_id = p.id
        GROUP BY p.id, p.name
        ORDER BY SUM(pr.cash_out - pr.buy_in) DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(Json(rows))
}

async fn add_player(
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePlayer>,
) -> Result<Json<Player>, String> {
    let player = create_player(&pool, payload.name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(Json(player))
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
    let results = create_game(&pool, payload)
        .await
        .map_err(|e| e.to_string())?;


    Ok(Json(results))
}

async fn create_game(
    pool: &PgPool,
    payload: CreateGameRequest,
) -> Result<CreateGameResponse, sqlx::Error> {
    // 1. Insert game
    let game = sqlx::query!(
        r#"
        INSERT INTO games (played_at)
        VALUES (NOW())
        RETURNING id
        "#
    )
    .fetch_one(pool)
    .await?;
    let game_id= game.id;
    // 2. Loop through every player in payload.results
    for player in payload.results {
        insert_player_result(
            pool,
            game_id,
            player.player_id,
            player.buy_in,
            player.cash_out,
        )
        .await?;
    }

    // 3. Return the game id
    Ok(CreateGameResponse{id:game_id})
}

async fn insert_player_result(
    pool: &PgPool,
    game_id: i32,
    player_id: i32,
    buy_in: i32,
    cash_out: i32,
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
    .execute(pool)
    .await?;
    Ok(())
}


#[tokio::main]
async fn main() {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .unwrap();

    let app = Router::new()
        .route("/", get(health_check))
        .route("/leaderboard", get(leaderboard))
        .route("/player", post(add_player))
        .route("/game", post(add_game))
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    println!("Listening on port 3000");

    axum::serve(listener, app).await.unwrap();
}