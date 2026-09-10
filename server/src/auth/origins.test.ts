import { expect, it } from 'vitest'
import { allowedOrigins } from './origins.js'

it('includes the canonical deployment and normalizes trailing slashes', () => {
  expect(allowedOrigins('https://chat.example.com/', ' https://chat.example.com/,https://preview.example.com ')).toEqual(['https://chat.example.com', 'https://preview.example.com'])
})
it('does not accept wildcards, null origins or non-http URLs', () => {
  expect(allowedOrigins('https://chat.example.com', '*,null,javascript:alert(1)')).toEqual(['https://chat.example.com'])
})
