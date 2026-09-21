"use client"

import Link from "next/link"
import useSWR from "swr"
import { ChevronRightIcon, UsersIcon } from "lucide-react"

import { getPlayers, type Player } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ErrorState } from "@/components/error-state"
import { EmptyState } from "@/components/empty-state"
import { AddPlayerDialog } from "@/components/add-player-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function PlayersPage() {
  const { data, error, isLoading, mutate } = useSWR<Player[]>(
    "players",
    getPlayers,
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Players"
        description="Everyone who can join a game."
        icon={UsersIcon}
      >
        <AddPlayerDialog onCreated={() => mutate()} />
      </PageHeader>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No players yet"
          description="Add your first player to get started."
        >
          <AddPlayerDialog onCreated={() => mutate()} />
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((player) => (
            <Link key={player.id} href={`/players/${player.id}`}>
              <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{player.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Added {formatDate(player.created_at)}
                    </span>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
