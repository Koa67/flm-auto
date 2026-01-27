/**
 * FLM AUTO - Error Logger
 * Sentry-ready: npm install @sentry/nextjs && npx @sentry/wizard -i nextjs
 */

// import * as Sentry from '@sentry/nextjs'

export interface ErrorContext {
  endpoint?: string
  userId?: string
  params?: Record<string, unknown>
  [key: string]: unknown
}

export function logError(error: Error | unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error))
  
  if (process.env.NODE_ENV === 'development') {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ ERROR:', err.message)
    if (context) console.error('📍 Context:', JSON.stringify(context, null, 2))
    console.error('📚 Stack:', err.stack)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return
  }

  // Production: structured JSON logging
  console.error(JSON.stringify({
    level: 'error',
    message: err.message,
    stack: err.stack,
    context,
    timestamp: new Date().toISOString(),
  }))

  // Sentry.captureException(err, { extra: context })
}

export function logWarning(message: string, context?: ErrorContext): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ WARNING:', message, context)
    return
  }
  console.warn(JSON.stringify({ level: 'warning', message, context, timestamp: new Date().toISOString() }))
}

export function logInfo(message: string, context?: ErrorContext): void {
  if (process.env.NODE_ENV === 'development') {
    console.info('ℹ️ INFO:', message, context)
    return
  }
  console.info(JSON.stringify({ level: 'info', message, context, timestamp: new Date().toISOString() }))
}
