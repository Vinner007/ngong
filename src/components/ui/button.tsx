import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/cn"

// Every size is at least 44px tall: the minimum comfortable touch target (Apple HIG, WCAG 2.5.8).
export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        secondary: "border border-border bg-surface text-text hover:bg-surface-hover",
        soft: "bg-primary-soft text-primary hover:bg-surface-hover",
        ghost: "text-text hover:bg-surface-hover",
        danger: "bg-danger text-white hover:opacity-90 dark:text-bg",
      },
      size: {
        md: "min-h-11 px-4 text-[15px]",
        lg: "min-h-12 px-5 text-base",
        icon: "size-11 shrink-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}
