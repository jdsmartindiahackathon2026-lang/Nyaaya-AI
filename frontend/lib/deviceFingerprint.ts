/**
 * Zero-dependency client-side hardware & browser fingerprinting utility.
 * Generates a stable SHA-256 device identifier using canvas 2D rendering quirks,
 * WebGL renderer/vendor strings, hardware concurrency, screen dimensions,
 * color depth, timezone offset, and audio context characteristics.
 *
 * Used strictly for Sybil attack & quota evasion detection on Free tier accounts.
 */

async function sha256(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas-ctx";

    // Text with subtle gradients, shadows, and composite operations
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial', sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Nyaaya.AI,device~fp.492!?", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Nyaaya.AI,device~fp.492!?", 4, 17);

    return canvas.toDataURL();
  } catch {
    return "canvas-failed";
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "no-webgl";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "";
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
      return `${vendor}~${renderer}`;
    }
    return gl.getParameter(gl.VENDOR) + "~" + gl.getParameter(gl.RENDERER);
  } catch {
    return "webgl-failed";
  }
}

export async function getDeviceId(): Promise<string> {
  if (typeof window === "undefined") {
    return "server-env";
  }

  // Check sessionStorage / localStorage cache first to avoid re-computing canvas every query
  const cached = localStorage.getItem("nyaaya_device_fp");
  if (cached && cached.startsWith("hw_") && cached.length === 67) {
    return cached;
  }

  try {
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const tzOffset = new Date().getTimezoneOffset();
    const language = navigator.language || "";
    const hardwareConcurrency = navigator.hardwareConcurrency || 0;
    const canvasHash = getCanvasFingerprint();
    const webglHash = getWebGLFingerprint();

    const rawSignature = [
      screenInfo,
      timezone,
      tzOffset,
      language,
      hardwareConcurrency,
      canvasHash,
      webglHash,
    ].join("|||");

    const digest = await sha256(rawSignature);
    const deviceId = `hw_${digest}`;

    try {
      localStorage.setItem("nyaaya_device_fp", deviceId);
    } catch {
      // Ignore storage quota or disabled storage errors
    }

    return deviceId;
  } catch (err) {
    console.warn("Device fingerprinting failed:", err);
    // Fallback pseudo-random token stored locally if crypto subtle or canvas fails
    let fallback = localStorage.getItem("nyaaya_device_fp_fallback");
    if (!fallback) {
      fallback = `hw_fallback_${Math.random().toString(36).slice(2)}${Date.now()}`;
      try {
        localStorage.setItem("nyaaya_device_fp_fallback", fallback);
      } catch {
        // Ignore
      }
    }
    return fallback;
  }
}
