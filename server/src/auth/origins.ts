// Use configured origins only; never trust a caller-controlled Host header.
export function allowedOrigins(appUrl: string, configured: string): string[] {
  return [...new Set([appUrl, ...configured.split(',')].map((value) => {
    try { const url = new URL(value.trim()); return ['https:', 'http:'].includes(url.protocol) ? url.origin : '' } catch { return '' }
  }).filter(Boolean))]
}
