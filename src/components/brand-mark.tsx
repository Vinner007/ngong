import { cn } from "@/lib/cn"

/** The logo: a speech bubble with a question mark, drawn inline so it follows the theme colour. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M9 10.5A3.5 3.5 0 0 1 12.5 7h7A3.5 3.5 0 0 1 23 10.5v6a3.5 3.5 0 0 1-3.5 3.5H15l-4.2 3.6c-.5.4-1.3.1-1.3-.6V20A3.5 3.5 0 0 1 9 16.5z"
        className="fill-primary-fg"
      />
      <path
        d="M14.2 11.3a1.9 1.9 0 0 1 3.7.6c0 1.3-1.9 1.6-1.9 2.8M16 16.6h.01"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="stroke-primary"
      />
    </svg>
  )
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <BrandMark />
      <span>งงตรงไหน</span>
    </span>
  )
}
