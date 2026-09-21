export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

// ---------- Types ----------

export type Player = {
  id: number
  name: string
  created_at: string
}

export type PlayerDetail = {
  id: number
  name: string
  profit: number
  games: number
  game_ids: number[]
}

export type LeaderboardEntry = {
  id: number
  name: string
  profit: number
  games: number
}

export type GameResult = {
  player_id: number
  player_name: string
  buy_in: number
  cash_out: number
}

export type Game = {
  id: number
  played_at: string
  results: GameResult[]
}

export type NewGameResult = {
  player_id: number
  buy_in: number
  cash_out: number
}

// ---------- Error handling ----------

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    })
  } catch {
    throw new ApiError(
      `Can't reach the backend at ${API_URL}. Make sure it's running (cargo run on port 3001).`,
      0,
    )
  }

  if (!res.ok) {
    throw new ApiError(
      res.status === 404
        ? "Not found."
        : `Request failed (${res.status} ${res.statusText}).`,
      res.status,
    )
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

// ---------- Players ----------

export function createPlayer(name: string): Promise<Player> {
  return request<Player>("/player", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export function getPlayers(): Promise<Player[]> {
  return request<Player[]>("/players")
}

export function getPlayer(id: number): Promise<PlayerDetail> {
  return request<PlayerDetail>(`/players/${id}`)
}

export function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>("/leaderboard")
}

// ---------- Games ----------

export function createGame(results: NewGameResult[]): Promise<{ id: number }> {
  return request<{ id: number }>("/game", {
    method: "POST",
    body: JSON.stringify({ results }),
  })
}

export function getGames(): Promise<Game[]> {
  return request<Game[]>("/games")
}

export function getGame(id: number): Promise<Game> {
  return request<Game>(`/game/${id}`)
}

export function deleteGame(id: number): Promise<void> {
  return request<void>(`/game/${id}`, { method: "DELETE" })
}

export function updateGame(
  id: number,
  body: { played_at?: string; results?: NewGameResult[] },
): Promise<Game> {
  return request<Game>(`/game/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

// ---------- Live buy-in / cash-out ----------

// Additive: `amount` is added to the existing buy_in.
export function addBuyIn(
  gameId: number,
  playerId: number,
  amount: number,
): Promise<GameResult> {
  return request<GameResult>(`/game/${gameId}/players/${playerId}/buy-in`, {
    method: "PATCH",
    body: JSON.stringify({ amount }),
  })
}

// Absolute: sets cash_out to `amount`.
export function setCashOut(
  gameId: number,
  playerId: number,
  amount: number,
): Promise<GameResult> {
  return request<GameResult>(`/game/${gameId}/players/${playerId}/cash-out`, {
    method: "PATCH",
    body: JSON.stringify({ amount }),
  })
}
