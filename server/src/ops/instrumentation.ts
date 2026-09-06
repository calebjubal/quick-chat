import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import * as Sentry from '@sentry/node'
import { env } from '../env.js'

let telemetry: NodeSDK | undefined
if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  telemetry = new NodeSDK({ traceExporter: new OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces` }) })
  telemetry.start()
}
if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, sendDefaultPii: false, tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1 })

export const captureException = (error: unknown, requestId?: string) => { if (env.SENTRY_DSN) Sentry.captureException(error, { tags: { requestId } }) }
export const shutdownTelemetry = () => telemetry?.shutdown() ?? Promise.resolve()
