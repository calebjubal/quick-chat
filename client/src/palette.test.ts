/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const luminance = (hex: string) => {
  const channels = hex.match(/[\da-f]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
const contrast = (foreground: string, background: string) => { const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05) }

describe('production palette', () => {
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
  for (const [theme, block] of ['light', 'dark'].map((theme, index) => [theme, css.split('}')[index]])) {
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]))
    it.each([['text', 'canvas'], ['text', 'surface'], ['muted', 'surface'], ['on-brand', 'brand'], ['text', 'outgoing']])(`${theme}: readable %s on %s`, (foreground, background) => expect(contrast(tokens[foreground], tokens[background])).toBeGreaterThanOrEqual(4.5))
  }
})
