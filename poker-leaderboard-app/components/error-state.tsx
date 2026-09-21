"use client"

import { RefreshCwIcon, ServerCrashIcon } from "lucide-react"

import { ApiError } from "@/lib/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const isNetwork = error instanceof ApiError && error.status === 0
  const message =
    error instanceof Error ? error.message : "Something went wrong."

  return (
    <Alert variant="destructive">
      <ServerCrashIcon />
      <AlertTitle>
        {isNetwork ? "Can't reach the backend" : "Failed to load"}
      </AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onRetry}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
