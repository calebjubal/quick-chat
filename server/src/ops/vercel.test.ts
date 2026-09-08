import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('routes same-origin API requests before the SPA fallback', () => {
  const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'))
  expect(config.framework).toBeNull()
  expect(config.outputDirectory).toBe('client/dist')
  expect(config.rewrites[0]).toEqual({ source: '/api/:path*', destination: '/api/index' })
  expect(config.functions['api/index.js'].includeFiles).toBe('server/dist/**')
  expect(readFileSync(new URL('../../../api/index.js', import.meta.url), 'utf8')).toContain('../server/dist/http.js')
})
