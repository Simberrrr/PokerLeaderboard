"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { PlusCircleIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { createGame, getPlayers, type Player } from "@/lib/api"
import { formatMoney } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ErrorState } from "@/components/error-state"
import { EmptyState } from "@/components/empty-state"
import { AddPlayerDialog } from "@/components/add-player-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const DEFAULT_BUY_IN = 100

type Selection = { selected: boolean; buyIn: string }

export default function NewGamePage() {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<Player[]>(
    "players",
    getPlayers,
  )

  const [selections, setSelections] = React.useState<Record<number, Selection>>(
    {},
  )
  const [submitting, setSubmitting] = React.useState(false)

  function getSelection(id: number): Selection {
    return selections[id] ?? { selected: false, buyIn: String(DEFAULT_BUY_IN) }
  }

  function toggle(id: number, selected: boolean) {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...getSelection(id), selected },
    }))
  }

  function setBuyIn(id: number, buyIn: string) {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...getSelection(id), buyIn },
    }))
  }

  const chosen = (data ?? []).filter((p) => getSelection(p.id).selected)
  const totalBuyIn = chosen.reduce(
    (sum, p) => sum + (Number(getSelection(p.id).buyIn) || 0),
    0,
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (chosen.length === 0) {
      toast.error("Select at least one player.")
      return
    }

    const results = chosen.map((p) => {
      const buyIn = Math.round(Number(getSelection(p.id).buyIn))
      return { player_id: p.id, buy_in: buyIn, cash_out: 0 }
    })

    if (results.some((r) => !Number.isFinite(r.buy_in) || r.buy_in < 0)) {
      toast.error("Buy-ins must be zero or a positive whole number.")
      return
    }

    setSubmitting(true)
    try {
      const { id } = await createGame(results)
      toast.success("Game started")
      router.push(`/games/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start game.")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New game"
        description="Pick who's playing and set each starting buy-in."
        icon={PlusCircleIcon}
      >
        {data && data.length > 0 ? (
          <AddPlayerDialog onCreated={() => mutate()} />
        ) : null}
      </PageHeader>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No players yet"
          description="Add players before starting a game."
        >
          <AddPlayerDialog onCreated={() => mutate()} />
        </EmptyState>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {data.map((player) => {
              const sel = getSelection(player.id)
              return (
                <Card
                  key={player.id}
                  className={cn(
                    "transition-colors",
                    sel.selected && "border-primary/50 bg-muted/40",
                  )}
                >
                  <CardContent className="flex items-center gap-3">
                    <Checkbox
                      id={`player-${player.id}`}
                      checked={sel.selected}
                      onCheckedChange={(checked) =>
                        toggle(player.id, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`player-${player.id}`}
                      className="flex-1 cursor-pointer font-medium"
                    >
                      {player.name}
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Buy-in $
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={sel.buyIn}
                        disabled={!sel.selected}
                        onChange={(e) => setBuyIn(player.id, e.target.value)}
                        className="w-24 tabular-nums"
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {chosen.length} player{chosen.length === 1 ? "" : "s"} selected
              {" · "}
              <span className="tabular-nums text-foreground">
                {formatMoney(totalBuyIn)}
              </span>{" "}
              on the table
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" render={<Link href="/games" />} nativeButton={false}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || chosen.length === 0}>
                {submitting ? <Spinner data-icon="inline-start" /> : null}
                Start game
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
