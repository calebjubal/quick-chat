import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('routes REST and socket upgrades to a bundled Node server', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  expect(config.framework).toBeNull()
  expect(config.buildCommand).toContain('--filter ./server build')
  expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/api/index' }])
  expect(config.functions['api/index.js'].includeFiles).toBe('dist/**')
  expect(readFileSync(new URL('../../api/index.js', import.meta.url), 'utf8')).toContain("export { default } from '../dist/index.js'")
})
