"use client"

import QRCode from "qrcode"
import { useMemo } from "react"
import { cn } from "@/lib/cn"

/**
 * Renders a QR code as one SVG path built from the module grid. No canvas, no innerHTML,
 * and it stays sharp at any size, including on a projector.
 */
export function QrCode({ value, className, label }: { value: string; className?: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" })
    const moduleCount = qr.modules.size
    let d = ""
    for (let row = 0; row < moduleCount; row++) {
      for (let column = 0; column < moduleCount; column++) {
        if (qr.modules.get(row, column)) d += `M${column} ${row}h1v1h-1z`
      }
    }
    return { size: moduleCount, path: d }
  }, [value])

  const quietZone = 2
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-quietZone} ${-quietZone} ${size + quietZone * 2} ${size + quietZone * 2}`}
      className={cn("rounded-2xl bg-white", className)}
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#0f172a" />
    </svg>
  )
}
