"use client"

import { X } from "lucide-react"
import { Drawer } from "vaul"
import { cn } from "@/lib/cn"

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * A sheet that slides up from the bottom: the natural place for secondary actions on a phone,
 * reachable with the thumb and dismissible by swiping down. Focus is trapped while it is open.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-surface outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border" aria-hidden />
          <div className="flex items-start gap-3 px-5 pt-3">
            <div className="min-w-0 flex-1">
              <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-0.5 text-sm text-muted">
                  {description}
                </Drawer.Description>
              ) : null}
            </div>
            <Drawer.Close
              className="-mr-2 -mt-1 inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
              aria-label="ปิด"
            >
              <X className="size-5" aria-hidden />
            </Drawer.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
