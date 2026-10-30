import { DoorClosed, SearchX, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { JoinForm } from "@/components/landing/join-form"

/** Placeholder shapes while the room loads, so the layout does not jump when data arrives. */
export function RoomSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg animate-pulse px-4 pt-6" aria-busy="true" aria-label="กำลังโหลดห้อง">
      <div className="h-6 w-2/3 rounded-lg bg-surface-hover" />
      <div className="mt-2 h-4 w-1/3 rounded-lg bg-surface-hover" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-24 rounded-[var(--radius-card)] bg-surface-hover" />
        ))}
      </div>
    </div>
  )
}

function StateScreen({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof SearchX
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-7" aria-hidden />
      </div>
      <h1 className="mt-5 text-center text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-center text-muted">{description}</p>
      <div className="mt-8">{children}</div>
    </main>
  )
}

export function RoomNotFound() {
  return (
    <StateScreen
      icon={SearchX}
      title="ไม่พบห้องนี้"
      description="รหัสอาจพิมพ์ผิด หรือห้องหมดอายุแล้ว (ห้องจะถูกลบอัตโนมัติหลัง 24 ชั่วโมง)"
    >
      <JoinForm />
    </StateScreen>
  )
}

export function RoomDeleted() {
  return (
    <StateScreen
      icon={DoorClosed}
      title="ห้องนี้ถูกลบแล้ว"
      description="ผู้สอนลบห้องและข้อมูลทั้งหมดแล้ว ขอบคุณที่ช่วยบอกว่างงตรงไหนนะ"
    >
      <Link href="/" className={buttonVariants({ variant: "secondary", block: true })}>
        กลับหน้าแรก
      </Link>
    </StateScreen>
  )
}

export function RoomError({ onRetry }: { onRetry: () => void }) {
  return (
    <StateScreen
      icon={TriangleAlert}
      title="โหลดห้องไม่สำเร็จ"
      description="อาจเป็นเพราะอินเทอร์เน็ต ลองใหม่อีกครั้ง"
    >
      <button type="button" onClick={onRetry} className={buttonVariants({ block: true })}>
        ลองใหม่
      </button>
    </StateScreen>
  )
}
