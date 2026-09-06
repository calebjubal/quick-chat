import { describe, expect, it } from 'vitest'

const luminance = (hex: string) => {
  const channels = hex.match(/[\da-f]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
const contrast = (foreground: string, background: string) => { const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05) }

describe('Flash-inspired palette', () => {
  it.each([
    ['#26120d', '#fff8ef'], ['#715d55', '#ffffff'], ['#ffffff', '#b51e2e'],
    ['#fff5e6', '#16090a'], ['#cdb9ac', '#211012'], ['#211012', '#ffc928'],
  ])('keeps readable foreground %s on %s', (foreground, background) => expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5))
})
