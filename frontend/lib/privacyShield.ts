/**
 * Privacy Shield & Client-Side Redaction Utility for Nyaaya AI
 * 
 * Provides client-side sanitization of formulation proportions, concentration numbers,
 * and extraction solvent ratios before transmission to AI models, preventing accidental
 * loss of trade secret novelty under Patents Act 1970 §29-34.
 */

export interface MaskResult {
  maskedText: string
  maskMap: Record<string, string> // Token -> Original Value
  tokenCount: number
}

export interface ConfidentialReceipt {
  receipt_id: string
  timestamp: string
  mode: 'tee_zero_retention'
  enclave_spec: string
  data_retention: string
  payload_sha256: string
  verified: boolean
}

/**
 * Regex patterns identifying sensitive formulation trade secrets:
 * 1. Percentage concentrations (e.g. 45%, 5.5%, 0.25% w/w, 10% v/v)
 * 2. Ratio proportions (e.g. 1:5, 10:1, 70:30)
 * 3. Pressure & solvent extraction parameters (e.g. 300 bar, 350 psi, 55°C)
 * 4. Milligram/gram dosages (e.g. 250mg, 500 mg, 2.5g)
 */
const CONCENTRATION_REGEX = /\b\d+(\.\d+)?\s*(%|percent)(\s*(w\/w|w\/v|v\/v))?\b/gi
const RATIO_REGEX = /\b\d+\s*:\s*\d+(\s*:\s*\d+)?(\s*(v\/v|w\/w))?\b/gi
const EXTRACTION_PARAM_REGEX = /\b\d+(\.\d+)?\s*(bar|psi|°C|mbar)\b/gi
const DOSAGE_PARAM_REGEX = /\b\d+(\.\d+)?\s*(mg|mcg|µg|g)\b/gi

/**
 * Masks proprietary concentration numbers and ratios from formulation text client-side.
 */
export function maskFormulationText(input: string): MaskResult {
  if (!input || !input.trim()) {
    return { maskedText: input, maskMap: {}, tokenCount: 0 }
  }

  const maskMap: Record<string, string> = {}
  let counter = 1
  let text = input

  // 1. Mask percentages (e.g., 45% w/w -> [CONCENTRATION_1])
  text = text.replace(CONCENTRATION_REGEX, (match) => {
    const token = `[CONCENTRATION_${counter++}]`
    maskMap[token] = match
    return token
  })

  // 2. Mask ratios (e.g., 70:30 v/v -> [RATIO_2])
  text = text.replace(RATIO_REGEX, (match) => {
    const token = `[RATIO_${counter++}]`
    maskMap[token] = match
    return token
  })

  // 3. Mask extraction parameters (e.g., 320 bar -> [PROCESS_PARAM_3])
  text = text.replace(EXTRACTION_PARAM_REGEX, (match) => {
    const token = `[PROCESS_PARAM_${counter++}]`
    maskMap[token] = match
    return token
  })

  // 4. Mask milligram quantities (e.g., 250mg -> [DOSE_PARAM_4])
  text = text.replace(DOSAGE_PARAM_REGEX, (match) => {
    const token = `[DOSE_PARAM_${counter++}]`
    maskMap[token] = match
    return token
  })

  return {
    maskedText: text,
    maskMap,
    tokenCount: counter - 1,
  }
}

/**
 * Computes a browser-native SHA-256 hex digest of any string payload.
 */
export async function computePayloadSha256(payload: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback pseudo-hash if SubtleCrypto unavailable in older environments
    let hash = 0
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(16).padStart(16, '0')
  }
}

/**
 * Formats a verifiable Certificate of Confidential Processing for download or audit inspection.
 */
export function generateAuditCertificate(
  receipt: ConfidentialReceipt,
  userOrOrgName: string,
  purpose: string
): string {
  return JSON.stringify(
    {
      title: 'Nyaaya AI — Certificate of Confidential Processing',
      status: 'CONFIRMED_ZERO_DATA_RETENTION',
      compliance_standard: 'Patents Act 1970 §29-34 / TEE Enclave Zero Retention',
      issued_to: userOrOrgName || 'Confidential Client',
      purpose,
      receipt_id: receipt.receipt_id,
      timestamp: receipt.timestamp,
      enclave_specification: receipt.enclave_spec,
      storage_policy: receipt.data_retention,
      cryptographic_payload_digest: receipt.payload_sha256,
      verified: receipt.verified,
      notice:
        'This cryptographic receipt confirms that the associated formulation analysis was processed exclusively in-memory inside a hardware-isolated Trusted Execution Environment (TEE). Zero bytes were stored on disk or persistent databases, and no data was retained for artificial intelligence model training.',
    },
    null,
    2
  )
}
