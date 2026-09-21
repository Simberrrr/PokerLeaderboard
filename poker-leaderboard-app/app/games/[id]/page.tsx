"use client"

import { use } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeftIcon, GamepadIcon } from "lucide-react"

import { ApiError, getGame, type Game } from "@/lib/api"
import { formatDate, formatMoney, formatSignedMoney, profitClass } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ErrorState } from "@/components/error-state"
import { EmptyState } from "@/components/empty-state"
import { GamePlayerCard } from "@/components/game-player-card"
import { DeleteGameButton } from "@/components/delete-game-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function ActiveGamePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const gameId = Number(id)

  const { data, error, isLoading, mutate } = useSWR<Game>(
    `game-${gameId}`,
    () => getGame(gameId),
  )

  const notFound = error instanceof ApiError && error.status === 404

  const totalBuyIn = data?.results.reduce((s, r) => s + r.buy_in, 0) ?? 0
  const totalCashOut = data?.results.reduce((s, r) => s + r.cash_out, 0) ?? 0
  const balanced = totalBuyIn === totalCashOut

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        render={<Link href="/games" />}
        nativeButton={false}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        All games
      </Button>

      {notFound ? (
        <EmptyState
          icon={GamepadIcon}
          title="Game not found"
          description="This game doesn't exist or was deleted."
        >
          <Button render={<Link href="/games" />} nativeButton={false}>Back to games</Button>
        </EmptyState>
      ) : error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={`Game #${data.id}`}
            description={formatDate(data.played_at)}
            icon={GamepadIcon}
          >
            <DeleteGameButton gameId={data.id} />
          </PageHeader>

          {data.results.length === 0 ? (
            <EmptyState
              icon={GamepadIcon}
              title="No players in this game"
              description="This game has no results recorded."
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {data.results.map((result) => (
                  <GamePlayerCard
                    key={result.player_id}
                    gameId={data.id}
                    result={result}
                    onUpdated={() => mutate()}
                  />
                ))}
              </div>

              <Card className={cn(!balanced && "border-red-500/50")}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total buy-ins
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(totalBuyIn)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total cash-outs
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(totalCashOut)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="font-medium">Difference</span>
                    {balanced ? (
                      <Badge variant="secondary">Balanced</Badge>
                    ) : (
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          profitClass(totalCashOut - totalBuyIn),
                        )}
                      >
                        {formatSignedMoney(totalCashOut - totalBuyIn)}
                      </span>
                    )}
                  </div>
                  {!balanced ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Buy-ins and cash-outs don&apos;t match yet. Once everyone
                      cashes out these should be equal.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
