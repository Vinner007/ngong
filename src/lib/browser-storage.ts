// localStorage can throw (private mode, blocked storage), so every access is guarded.
// Only small conveniences live here; nothing that matters for security or correctness.

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Not being able to remember a preference is fine.
  }
}

export const STORAGE_KEYS = {
  privacyNoticeSeen: "ngong:privacy-notice-seen",
  lastHostedRoom: "ngong:last-hosted-room",
} as const
