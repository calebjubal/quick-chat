// Wait for completion before scheduling again; hidden tabs stop polling.
export function startPolling(refresh: () => Promise<void>, interval = 3000) {
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const poll = async () => {
    if (stopped || running || document.visibilityState === 'hidden') return
    running = true
    try { await refresh() } catch { /* Store exposes errors. */ }
    finally { running = false; if (!stopped) timer = setTimeout(() => void poll(), interval) }
  }
  const resume = () => { clearTimeout(timer); void poll() }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  void poll()
  return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume) }
}
