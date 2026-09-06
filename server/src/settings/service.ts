export const accountDeletionDate = (now = new Date()) => new Date(now.getTime() + 30 * 86400000)

export const describeDevice = (userAgent: string | null) => {
  if (!userAgent) return 'Unknown device'
  if (/iphone|ipad/i.test(userAgent)) return 'Apple mobile device'
  if (/android/i.test(userAgent)) return 'Android device'
  if (/windows/i.test(userAgent)) return 'Windows device'
  if (/macintosh|mac os/i.test(userAgent)) return 'Mac device'
  if (/linux/i.test(userAgent)) return 'Linux device'
  return 'Web browser'
}
