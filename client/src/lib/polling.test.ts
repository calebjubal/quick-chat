// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { startPolling } from './polling'
afterEach(() => vi.useRealTimers())
it('polls without overlap and stops on cleanup', async () => {
  vi.useFakeTimers()
  const refresh = vi.fn().mockResolvedValue(undefined)
  const stop = startPolling(refresh)
  await vi.advanceTimersByTimeAsync(6100)
  expect(refresh).toHaveBeenCalledTimes(3)
  stop()
  await vi.advanceTimersByTimeAsync(9000)
  expect(refresh).toHaveBeenCalledTimes(3)
})
it('does not overlap a pending request or restart after cleanup', async () => {
  vi.useFakeTimers()
  let done!: () => void
  const refresh = vi.fn(() => new Promise<void>((resolve) => { done = resolve }))
  const stop = startPolling(refresh)
  await vi.advanceTimersByTimeAsync(12000)
  expect(refresh).toHaveBeenCalledTimes(1)
  stop(); done()
  await vi.advanceTimersByTimeAsync(12000)
  expect(refresh).toHaveBeenCalledTimes(1)
})
