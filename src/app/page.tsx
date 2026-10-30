import { EyeOff, MessageCircleQuestionMark, QrCode, Sparkles } from "lucide-react"
import { BrandName } from "@/components/brand-mark"
import { CreateRoom } from "@/components/landing/create-room"
import { JoinForm } from "@/components/landing/join-form"

const STEPS = [
  { icon: QrCode, title: "สแกน QR", text: "ไม่ต้องสมัคร ไม่ต้องล็อกอิน" },
  { icon: MessageCircleQuestionMark, title: "พิมพ์ว่างงตรงไหน", text: "ไม่มีใครเห็นชื่อคุณ" },
  { icon: Sparkles, title: "AI รวมเรื่องที่งง", text: "ผู้สอนเห็นทันทีว่าต้องทวนเรื่องไหน" },
] as const

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <BrandName className="text-lg" />
      </header>

      <section className="mt-10">
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">ถามได้ ไม่ต้องยกมือ</h1>
        <p className="mt-3 text-[17px] text-muted">
          ส่งความงงแบบไม่ระบุชื่อ แล้ว AI จะรวมเรื่องที่ทั้งห้องงง ให้ผู้สอนเห็นแบบเรียลไทม์
        </p>
      </section>

      <section className="mt-8 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-sm">
        <JoinForm />
      </section>

      <div className="my-6 flex items-center gap-3 text-sm text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        หรือ
        <span className="h-px flex-1 bg-border" />
      </div>

      <CreateRoom />

      <section className="mt-12" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-sm font-semibold text-muted">
          ทำงานยังไง
        </h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium">
                  <span className="sr-only">ขั้นที่ {index + 1}: </span>
                  {title}
                </p>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto flex items-start gap-2 pt-12 text-xs text-muted">
        <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>ไม่เก็บชื่อ อีเมล หรือ IP · ห้องและข้อความทั้งหมดลบอัตโนมัติใน 24 ชั่วโมง</p>
      </footer>
    </main>
  )
}
