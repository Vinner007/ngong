"use client"

import { Clock, EyeOff, ShieldCheck, UserX } from "lucide-react"
import { useEffect, useState } from "react"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { STORAGE_KEYS, readStored, writeStored } from "@/lib/browser-storage"

const PROMISES = [
  { icon: UserX, text: "ไม่ต้องสมัคร ไม่ต้องล็อกอิน ไม่มีใครรู้ว่าคุณเป็นใคร" },
  { icon: EyeOff, text: "เพื่อนเห็นแค่หัวข้อที่ AI สรุป ไม่เห็นข้อความของคุณ" },
  { icon: ShieldCheck, text: "ผู้สอนเห็นข้อความ แต่ไม่เห็นชื่อหรือข้อมูลใดๆ ของคุณ" },
  { icon: Clock, text: "ทุกอย่างถูกลบอัตโนมัติภายใน 24 ชั่วโมง" },
] as const

/** Shown once per browser: trust is the whole point, so we say exactly what is and is not shared. */
export function PrivacySheet() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Browser storage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!readStored(STORAGE_KEYS.privacyNoticeSeen)) setOpen(true)
  }, [])

  function close() {
    writeStored(STORAGE_KEYS.privacyNoticeSeen, "1")
    setOpen(false)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title="งงได้ ไม่ผิด"
      description="ห้องนี้ออกแบบมาให้ถามได้โดยไม่ต้องกลัว"
    >
      <ul className="space-y-3">
        {PROMISES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <p className="pt-2 text-[15px]">{text}</p>
          </li>
        ))}
      </ul>
      <Button size="lg" block className="mt-6" onClick={close}>
        เข้าใจแล้ว เริ่มเลย
      </Button>
    </BottomSheet>
  )
}
