'use client'
import { useEffect } from 'react'

interface Props {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: Props) {
  // ESC closes; Enter confirms
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      if (e.key === 'Enter')  { e.preventDefault(); onConfirm() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  const confirmStyles = variant === 'danger'
    ? { bg: 'rgba(226,54,54,0.14)', border: 'rgba(226,54,54,0.5)', color: '#f2a3a3', hoverBg: 'rgba(226,54,54,0.22)' }
    : { bg: '#1f5f4b', border: '#1f5f4b', color: '#eafaf0', hoverBg: '#245e4b' }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(4,10,8,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'confirmFadeIn 160ms ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        style={{
          maxWidth: 420, width: '100%',
          background: 'rgba(9,17,14,0.95)',
          border: `1px solid ${variant === 'danger' ? 'rgba(226,54,54,0.35)' : 'rgba(90,201,168,0.28)'}`,
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          padding: '22px 24px 18px',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          color: '#eaf3ee',
          animation: 'confirmSlideIn 200ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div id="confirm-title" style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 17, fontWeight: 700,
          color: variant === 'danger' ? '#f2a3a3' : '#f2f6f3',
          marginBottom: body ? 8 : 16,
          lineHeight: 1.35,
        }}>
          {title}
        </div>
        {body && (
          <div style={{ fontSize: 13.5, color: '#b7d4c5', lineHeight: 1.55, marginBottom: 20 }}>
            {body}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 18px', borderRadius: 999,
              border: '1px solid #2c5040',
              background: 'transparent', color: '#b7d4c5',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            style={{
              padding: '8px 20px', borderRadius: 999,
              border: `1px solid ${confirmStyles.border}`,
              background: confirmStyles.bg, color: confirmStyles.color,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = confirmStyles.hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = confirmStyles.bg)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confirmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes confirmSlideIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98) }
          to   { opacity: 1; transform: none }
        }
      `}</style>
    </div>
  )
}
