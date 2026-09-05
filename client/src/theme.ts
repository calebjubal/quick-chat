export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

export function applyTheme(preference: ThemePreference) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = resolveTheme(preference, systemDark)
  document.documentElement.style.colorScheme = resolveTheme(preference, systemDark)
}
