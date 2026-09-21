"use client"

import Link from "next/link"
import useSWR from "swr"
import { RefreshCwIcon, TrophyIcon } from "lucide-react"

import { getLeaderboard, type LeaderboardEntry } from "@/lib/api"
import { formatSignedMoney, profitClass } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { ErrorState } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const medals = ["text-amber-500", "text-zinc-400", "text-amber-700"]

export default function LeaderboardPage() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<
    LeaderboardEntry[]
  >("leaderboard", getLeaderboard)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leaderboard"
        description="Players ranked by total profit across all games."
        icon={TrophyIcon}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={isValidating}
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={cn(isValidating && "animate-spin")}
          />
          Refresh
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={TrophyIcon}
          title="No standings yet"
          description="Play a game to start building the leaderboard."
        >
          <Button render={<Link href="/games/new" />} nativeButton={false}>Start a game</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">Games</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          medals[index] ?? "text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/players/${entry.id}`}
                        className="font-medium hover:underline"
                      >
                        {entry.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {entry.games}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        profitClass(entry.profit),
                      )}
                    >
                      {formatSignedMoney(entry.profit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
