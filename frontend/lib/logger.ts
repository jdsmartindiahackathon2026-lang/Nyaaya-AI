'use client'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    name?: string
  }
  route?: string
  userAgent?: string
}

class DiagnosticLogger {
  private isProd = process.env.NODE_ENV === 'production'

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    err?: unknown
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    }

    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      }
    } else if (err) {
      entry.error = {
        message: String(err),
      }
    }

    return entry
  }

  public debug(message: string, context?: Record<string, unknown>) {
    if (this.isProd) return
    const entry = this.formatEntry('debug', message, context)
    console.debug(`[DEBUG] [${entry.timestamp}] ${message}`, context ?? '')
  }

  public info(message: string, context?: Record<string, unknown>) {
    const entry = this.formatEntry('info', message, context)
    if (!this.isProd) {
      console.info(`[INFO] [${entry.timestamp}] ${message}`, context ?? '')
    }
  }

  public warn(message: string, context?: Record<string, unknown>, err?: unknown) {
    const entry = this.formatEntry('warn', message, context, err)
    console.warn(`[WARN] [${entry.timestamp}] ${message}`, { ...context, err })
  }

  public error(message: string, err?: unknown, context?: Record<string, unknown>) {
    const entry = this.formatEntry('error', message, context, err)
    console.error(`[ERROR] [${entry.timestamp}] ${message}`, {
      error: entry.error,
      context: entry.context,
      route: entry.route,
    })

    // In production, buffer or dispatch to monitoring webhook if configured
    if (typeof window !== 'undefined' && this.isProd) {
      this.dispatchTelemetry(entry)
    }
  }

  private dispatchTelemetry(entry: LogEntry) {
    // Non-fatal telemetry dispatch placeholder for Sentry / Logflare / OpenTelemetry ingest
    try {
      if (window.sessionStorage) {
        const errorLog = JSON.parse(sessionStorage.getItem('nyaaya_error_telemetry_v1') || '[]')
        errorLog.push(entry)
        if (errorLog.length > 20) errorLog.shift()
        sessionStorage.setItem('nyaaya_error_telemetry_v1', JSON.stringify(errorLog))
      }
    } catch {
      // Storage unavailable or full; ignore
    }
  }

  public initGlobalHandlers() {
    if (typeof window === 'undefined') return

    window.addEventListener('error', (event: ErrorEvent) => {
      this.error('Uncaught browser runtime error', event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    })

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.error('Unhandled Promise rejection', event.reason)
    })
  }
}

export const logger = new DiagnosticLogger()
