"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { createPlayer } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function AddPlayerDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const player = await createPlayer(trimmed)
      toast.success(`Added ${player.name}`, { duration: 2000 })
      setName("")
      setOpen(false)
      onCreated?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add player.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon data-icon="inline-start" />
            Add player
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add player</DialogTitle>
            <DialogDescription>
              Create a new player to include in games.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="player-name">Name</FieldLabel>
              <Input
                id="player-name"
                value={name}
                autoFocus
                placeholder="e.g. Alex"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              Add player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
