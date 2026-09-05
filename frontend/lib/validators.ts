export const MAX_QUERY_LEN = 500
export const MAX_DESCRIPTION_LEN = 2000
export const MAX_NAME_LEN = 80
export const MAX_EMAIL_LEN = 254        // RFC 5321
export const MAX_TEXT_FIELD_LEN = 200

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

export function trimToLen(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}
