"use client"

import { use } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeftIcon, GamepadIcon, UserIcon, UserXIcon } from "lucide-react"

import { ApiError, getPlayer, type PlayerDetail } from "@/lib/api"
import { formatSignedMoney, profitClass } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ErrorState } from "@/components/error-state"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const playerId = Number(id)

  const { data, error, isLoading, mutate } = useSWR<PlayerDetail>(
    `player-${playerId}`,
    () => getPlayer(playerId),
  )

  const notFound = error instanceof ApiError && error.status === 404

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        render={<Link href="/players" />}
        nativeButton={false}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        All players
      </Button>

      {notFound ? (
        <EmptyState
          icon={UserXIcon}
          title="Player not found"
          description="This player doesn't exist or was removed."
        >
          <Button render={<Link href="/players" />} nativeButton={false}>Back to players</Button>
        </EmptyState>
      ) : error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <PageHeader title={data.name} icon={UserIcon} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardDescription>Total profit</CardDescription>
                <CardTitle
                  className={cn(
                    "text-3xl tabular-nums",
                    profitClass(data.profit),
                  )}
                >
                  {formatSignedMoney(data.profit)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Games played</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {data.games}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Games
            </h2>
            {data.game_ids.length === 0 ? (
              <EmptyState
                icon={GamepadIcon}
                title="No games yet"
                description="This player hasn't been in a game."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {data.game_ids.map((gameId) => (
                  <Link key={gameId} href={`/games/${gameId}`}>
                    <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                      <CardContent className="flex items-center gap-2">
                        <GamepadIcon className="size-4 text-muted-foreground" />
                        <span className="font-medium">Game #{gameId}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
