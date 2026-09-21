"use client"

import * as React from "react"
import { MinusIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { addBuyIn, setCashOut, type GameResult } from "@/lib/api"
import { formatMoney, formatSignedMoney, profitClass } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function GamePlayerCard({
  gameId,
  result,
  onUpdated,
}: {
  gameId: number
  result: GameResult
  onUpdated: () => void
}) {
  const [rebuy, setRebuy] = React.useState("")
  const [cashOut, setCashOutValue] = React.useState("")
  const [pending, setPending] = React.useState<"rebuy" | "cashout" | null>(null)

  const net = result.cash_out - result.buy_in

  async function handleRebuy() {
    const amount = Math.round(Number(rebuy))
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive rebuy amount.")
      return
    }
    setPending("rebuy")
    try {
      await addBuyIn(gameId, result.player_id, amount)
      setRebuy("")
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rebuy failed.")
    } finally {
      setPending(null)
    }
  }

  async function handleCashOut() {
    const amount = Math.round(Number(cashOut))
    if (cashOut.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a cash-out amount of zero or more.")
      return
    }
    setPending("cashout")
    try {
      await setCashOut(gameId, result.player_id, amount)
      setCashOutValue("")
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cash-out failed.")
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{result.player_name}</span>
          <span className={cn("text-base tabular-nums", profitClass(net))}>
            {formatSignedMoney(net)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Buy-in</span>
            <span className="tabular-nums font-medium">
              {formatMoney(result.buy_in)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Cash-out</span>
            <span className="tabular-nums font-medium">
              {formatMoney(result.cash_out)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="Rebuy amount"
              value={rebuy}
              onChange={(e) => setRebuy(e.target.value)}
              className="tabular-nums"
            />
            <Button
              variant="outline"
              onClick={handleRebuy}
              disabled={pending !== null}
            >
              {pending === "rebuy" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              Rebuy
            </Button>
          </div>

          <div className="flex flex-1 items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="Cash-out total"
              value={cashOut}
              onChange={(e) => setCashOutValue(e.target.value)}
              className="tabular-nums"
            />
            <Button onClick={handleCashOut} disabled={pending !== null}>
              {pending === "cashout" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <MinusIcon data-icon="inline-start" />
              )}
              Cash out
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
