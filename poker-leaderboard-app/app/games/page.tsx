"use client"

import Link from "next/link"
import useSWR from "swr"
import { ChevronRightIcon, GamepadIcon, PlusIcon } from "lucide-react"

import { getGames, type Game } from "@/lib/api"
import { formatDate, formatSignedMoney, profitClass } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ErrorState } from "@/components/error-state"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const diff =
      new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
    if (Number.isNaN(diff)) return b.id - a.id
    return diff || b.id - a.id
  })
}

export default function GamesPage() {
  const { data, error, isLoading, mutate } = useSWR<Game[]>("games", getGames)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Games"
        description="Every game you've tracked, newest first."
        icon={GamepadIcon}
      >
        <Button size="sm" render={<Link href="/games/new" />} nativeButton={false}>
          <PlusIcon data-icon="inline-start" />
          New game
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={GamepadIcon}
          title="No games yet"
          description="Start a game to begin tracking buy-ins and cash-outs."
        >
          <Button render={<Link href="/games/new" />} nativeButton={false}>Start a game</Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {sortGames(data).map((game) => (
            <Link key={game.id} href={`/games/${game.id}`}>
              <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>Game #{game.id}</span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(game.played_at)}
                  </span>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {game.results.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      No players
                    </span>
                  ) : (
                    game.results.map((r) => {
                      const net = r.cash_out - r.buy_in
                      return (
                        <Badge
                          key={r.player_id}
                          variant="outline"
                          className="gap-1.5 font-normal"
                        >
                          {r.player_name}
                          <span
                            className={cn("tabular-nums", profitClass(net))}
                          >
                            {formatSignedMoney(net)}
                          </span>
                        </Badge>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
