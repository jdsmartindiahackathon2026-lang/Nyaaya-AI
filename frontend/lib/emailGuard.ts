/**
 * Client-side email validation and normalization guard.
 * Prevents common alias-based multi-accounting abuse:
 * 1. Strips plus-addressing (e.g. user+test1@gmail.com -> user@gmail.com)
 * 2. Normalizes Google/Proton dot-insensitivity (u.s.e.r@gmail.com -> user@gmail.com)
 * 3. Blocks known disposable / temporary email domains (10minutemail, tempmail, etc.)
 */

// Common disposable/throwaway email providers frequently used for Sybil abuse
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "dispostable.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "trashmail.com",
  "fakeinbox.com",
  "getairmail.com",
  "generator.email",
  "nada.ltd",
  "mohmal.com",
  "crazymailing.com",
  "burnermail.io",
  "mytemp.email",
  "dropmail.me",
  "maildrop.cc",
]);

export interface EmailValidationResult {
  valid: boolean;
  normalizedEmail: string;
  error?: string;
}

/**
 * Normalizes an email address to its canonical mailbox form.
 * For Gmail & Googlemail: strips plus-tags and dots.
 * For Outlook / Proton / iCloud: strips plus-tags.
 */
export function normalizeEmail(rawEmail: string): string {
  const trimmed = rawEmail.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0) return trimmed;

  let local = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1);

  // Normalize googlemail.com to gmail.com
  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }

  // Handle Google-specific dot-insensitivity and plus-addressing
  if (domain === "gmail.com") {
    local = local.replace(/\./g, "");
    const plusIndex = local.indexOf("+");
    if (plusIndex !== -1) {
      local = local.slice(0, plusIndex);
    }
  } else {
    // Standard RFC-compliant plus-addressing stripping for other providers (outlook, proton, etc.)
    const plusIndex = local.indexOf("+");
    if (plusIndex !== -1) {
      local = local.slice(0, plusIndex);
    }
  }

  return `${local}@${domain}`;
}

/**
 * Validates whether an email is permissible for signup.
 * Rejects invalid structures and disposable throwaway mail providers.
 */
export function validateSignupEmail(rawEmail: string): EmailValidationResult {
  const trimmed = rawEmail.trim().toLowerCase();

  // Basic regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      error: "Please enter a valid email address.",
    };
  }

  const atIndex = trimmed.lastIndexOf("@");
  const domain = trimmed.slice(atIndex + 1);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      error: "Temporary or disposable email domains are not supported. Please use your primary work or personal email.",
    };
  }

  const normalized = normalizeEmail(trimmed);

  return {
    valid: true,
    normalizedEmail: normalized,
  };
}
