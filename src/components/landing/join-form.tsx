"use client"

import { LogIn } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ROOM_CODE_LENGTH, isValidRoomCode, normalizeRoomCode } from "@/shared/room-code"

export function JoinForm() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [touched, setTouched] = useState(false)
  const [navigating, setNavigating] = useState(false)

  const normalized = normalizeRoomCode(code)
  const isValid = isValidRoomCode(normalized)
  const showError = touched && normalized.length === ROOM_CODE_LENGTH && !isValid

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!isValid) return
    setNavigating(true)
    router.push(`/r/${normalized}`)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="room-code" className="text-sm font-medium">
        รหัสห้อง
      </label>
      <input
        id="room-code"
        name="room-code"
        value={code}
        onChange={(event) => setCode(event.target.value.slice(0, 12))}
        onBlur={() => setTouched(true)}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        placeholder="เช่น K7QX2M"
        aria-invalid={showError || undefined}
        aria-describedby="room-code-help"
        className="mt-1.5 block h-14 w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 text-center font-mono text-2xl font-semibold uppercase tracking-[0.3em] placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:border-primary"
      />
      <p id="room-code-help" className={showError ? "mt-1.5 text-sm text-danger" : "mt-1.5 text-sm text-muted"}>
        {showError ? "รหัสนี้ไม่ถูกต้อง ลองเช็คอีกครั้ง" : "6 ตัว ดูได้จากจอของผู้สอน หรือสแกน QR ได้เลย"}
      </p>
      <Button type="submit" size="lg" block className="mt-4" disabled={!isValid} loading={navigating}>
        {navigating ? null : <LogIn className="size-5" aria-hidden />}
        เข้าห้อง
      </Button>
    </form>
  )
}
