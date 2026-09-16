'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  compact?: boolean
  name?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    } else {
      console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}] caught error:`, error, errorInfo)
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      if (this.props.compact) {
        return (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(196,122,122,0.12)',
              border: '1px solid rgba(196,122,122,0.3)',
              color: '#e8a0a0',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span>Unable to render content safely.</span>
            <button
              onClick={this.handleReset}
              style={{
                background: 'transparent',
                border: '1px solid rgba(232,160,160,0.4)',
                color: '#e8a0a0',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )
      }

      return (
        <div
          style={{
            padding: '20px 24px',
            borderRadius: 12,
            background: 'rgba(196,122,122,0.08)',
            border: '1px solid rgba(196,122,122,0.25)',
            color: '#e8a0a0',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxWidth: 600,
            margin: '12px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <strong style={{ fontSize: 14, color: '#f2f6f3' }}>
              Rendering Error {this.props.name ? `in ${this.props.name}` : ''}
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#e8a0a0', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
          </p>
          <div>
            <button
              onClick={this.handleReset}
              style={{
                padding: '6px 14px',
                background: 'rgba(196,122,122,0.2)',
                border: '1px solid rgba(196,122,122,0.4)',
                borderRadius: 6,
                color: '#f2f6f3',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
            >
              Try Re-rendering
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
