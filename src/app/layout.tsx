import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans_Thai } from "next/font/google"
import { headers } from "next/headers"
import { ToastProvider } from "@/components/ui/toast"
import "./globals.css"

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "งงตรงไหน · ถามได้ ไม่ต้องยกมือ",
    template: "%s · งงตรงไหน",
  },
  description:
    "ส่งความงงแบบไม่ระบุชื่อ แล้ว AI รวมเรื่องที่ทั้งห้องงงให้อาจารย์เห็นแบบเรียลไทม์",
  applicationName: "งงตรงไหน",
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Shrinks the layout when the on-screen keyboard opens, so the composer stays visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request headers renders every page per request, which is what lets Next.js put
  // this request's CSP nonce on its scripts (see src/middleware.ts).
  await headers()

  return (
    <html lang="th" className={plexThai.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
