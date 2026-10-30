"use client"

// Keeps one room's state live in the browser:
// 1. load the room over HTTP (this also sets the device cookie),
// 2. open a WebSocket that pushes a fresh snapshot after every change,
// 3. reconnect with exponential backoff when the connection drops (phones lock, Wi-Fi flaps),
// 4. while the socket is down for a while, fall back to polling so the screen never goes stale.

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  HostSnapshot,
  RoomSnapshot,
  ServerMessage,
  SocketRole,
  Viewer,
} from "@/shared/types"
import { ApiError, api } from "./api-client"

export type RoomStatus = "loading" | "ready" | "not_found" | "deleted" | "error"
export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline"

type AssignedMessage = Extract<ServerMessage, { type: "assigned" }>

interface RoomEventHandlers {
  onAssigned?: (message: AssignedMessage) => void
  onProcessingFailed?: (questionId: number) => void
}

const PING_INTERVAL_MS = 25_000
const MAX_BACKOFF_MS = 15_000
const POLL_INTERVAL_MS = 5_000
/** After this many failed reconnects in a row, start polling until the socket comes back. */
const FAILURES_BEFORE_POLLING = 3

function backoffDelay(attempt: number): number {
  const base = Math.min(1_000 * 2 ** attempt, MAX_BACKOFF_MS)
  return base / 2 + Math.random() * (base / 2) // jitter, so a whole class does not reconnect at once
}

export function useRoom(code: string, role: SocketRole, handlers: RoomEventHandlers = {}) {
  const [status, setStatus] = useState<RoomStatus>("loading")
  const [snapshot, setSnapshot] = useState<RoomSnapshot | HostSnapshot | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [connection, setConnection] = useState<ConnectionState>("connecting")

  // Handlers change on every render; keep the latest without reconnecting the socket.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  const refresh = useCallback(async () => {
    try {
      const view = await api.getRoom(code)
      setSnapshot(view.snapshot)
      setViewer(view.viewer)
      setStatus("ready")
      return true
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") setStatus("not_found")
      else setStatus((current) => (current === "ready" ? current : "error"))
      return false
    }
  }, [code])

  useEffect(() => {
    let socket: WebSocket | null = null
    let stopped = false
    let failures = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let pingTimer: ReturnType<typeof setInterval> | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined

    const stopPolling = () => {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
    const startPolling = () => {
      if (pollTimer) return
      pollTimer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data === "pong") return
      let message: ServerMessage
      try {
        message = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        return
      }
      if (message.type === "snapshot") setSnapshot(message.snapshot)
      if (message.type === "assigned") handlersRef.current.onAssigned?.(message)
      if (message.type === "processing_failed") {
        handlersRef.current.onProcessingFailed?.(message.questionId)
      }
      if (message.type === "room_deleted") {
        stopped = true
        setStatus("deleted")
        discardSocket()
      }
    }

    const scheduleReconnect = () => {
      if (stopped) return
      clearTimeout(reconnectTimer)
      setConnection(navigator.onLine ? "reconnecting" : "offline")
      if (failures >= FAILURES_BEFORE_POLLING) startPolling()
      reconnectTimer = setTimeout(connect, backoffDelay(failures))
      failures += 1
    }

    function connect() {
      if (stopped) return
      const protocol = window.location.protocol === "https:" ? "wss" : "ws"
      const url = `${protocol}://${window.location.host}/api/rooms/${code}/socket?role=${role}`
      const current = new WebSocket(url)
      socket = current

      current.onopen = () => {
        failures = 0
        stopPolling()
        setConnection("live")
        // Anything that happened while we were away is in a fresh snapshot.
        void refresh()
        clearInterval(pingTimer)
        pingTimer = setInterval(() => current.send("ping"), PING_INTERVAL_MS)
      }
      current.onmessage = handleMessage
      current.onclose = () => {
        clearInterval(pingTimer)
        scheduleReconnect()
      }
    }

    /** Closes a socket we are replacing on purpose, without its close handler scheduling a reconnect. */
    const discardSocket = () => {
      if (!socket) return
      socket.onopen = null
      socket.onmessage = null
      socket.onclose = null
      socket.close()
      socket = null
    }

    const reconnectNow = () => {
      const busy =
        socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING
      if (stopped || busy) return
      failures = 0
      clearTimeout(reconnectTimer)
      discardSocket()
      connect()
    }

    const handleOffline = () => setConnection("offline")
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reconnectNow()
    }

    // refresh() only sets state after the network request resolves, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().then((found) => {
      if (found && !stopped) connect()
    })

    window.addEventListener("online", reconnectNow)
    window.addEventListener("offline", handleOffline)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopped = true
      clearTimeout(reconnectTimer)
      clearInterval(pingTimer)
      stopPolling()
      discardSocket()
      window.removeEventListener("online", reconnectNow)
      window.removeEventListener("offline", handleOffline)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [code, role, refresh])

  return { status, snapshot, viewer, setViewer, connection, refresh }
}
