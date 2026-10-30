"use client"

import { ArrowRight, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { api } from "@/lib/api-client"
import { STORAGE_KEYS, readStored, writeStored } from "@/lib/browser-storage"
import { errorMessage } from "@/lib/messages"
import { TITLE_MAX_LENGTH } from "@/shared/limits"
import { isValidRoomCode } from "@/shared/room-code"

export function CreateRoom() {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const [lastRoom, setLastRoom] = useState<string | null>(null)

  useEffect(() => {
    const stored = readStored(STORAGE_KEYS.lastHostedRoom)
    // Reading browser storage has to wait until after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && isValidRoomCode(stored)) setLastRoom(stored)
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)
    try {
      const { code } = await api.createRoom(title)
      writeStored(STORAGE_KEYS.lastHostedRoom, code)
      router.push(`/host/${code}`)
    } catch (error) {
      toast.show(errorMessage(error), "error")
      setCreating(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="lg" block onClick={() => setOpen(true)}>
        <Plus className="size-5" aria-hidden />
        สร้างห้องสำหรับผู้สอน
      </Button>

      {lastRoom ? (
        <Link
          href={`/host/${lastRoom}`}
          className={buttonVariants({ variant: "ghost", block: true, className: "mt-2 text-primary" })}
        >
          กลับไปที่ห้อง {lastRoom}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="สร้างห้องใหม่"
        description="ห้องจะอยู่ 24 ชั่วโมงแล้วลบตัวเองพร้อมข้อมูลทั้งหมด"
      >
        <form onSubmit={handleCreate}>
          <label htmlFor="room-title" className="text-sm font-medium">
            ชื่อวิชาหรือหัวข้อ <span className="font-normal text-muted">(ไม่ใส่ก็ได้)</span>
          </label>
          <input
            id="room-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="เช่น Data Structures คาบ 3"
            enterKeyHint="done"
            className="mt-1.5 block h-12 w-full rounded-[var(--radius-control)] border border-border bg-bg px-4 text-base placeholder:text-muted focus:border-primary"
          />
          <p className="mt-1.5 text-sm text-muted">
            ชื่อนี้ช่วยให้ AI ตั้งชื่อหัวข้อความงงได้ตรงวิชามากขึ้น
          </p>
          <Button type="submit" size="lg" block className="mt-5" loading={creating}>
            สร้างห้อง
          </Button>
        </form>
      </BottomSheet>
    </>
  )
}
