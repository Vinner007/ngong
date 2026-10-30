"use client"

import { CircleCheck, Info, TriangleAlert } from "lucide-react"
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/cn"

type ToastTone = "success" | "info" | "error"

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const VISIBLE_MS = 3_500

const TONE_ICON = {
  success: CircleCheck,
  info: Info,
  error: TriangleAlert,
} as const

const TONE_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  info: "text-primary",
  error: "text-danger",
}

/**
 * Toasts appear at the top of the screen, away from the composer and the thumb, and are
 * announced to screen readers through a polite live region.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++
    setToasts((current) => [...current.slice(-2), { id, tone, message }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), VISIBLE_MS)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone]
          return (
            <div
              key={toast.id}
              className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-[15px] shadow-lg shadow-black/10"
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", TONE_CLASS[toast.tone])} aria-hidden />
              <p className="min-w-0 flex-1">{toast.message}</p>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast must be used inside ToastProvider")
  return context
}
