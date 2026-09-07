export const ALLOWED_MEDIA = new Map<string, 'image' | 'video' | 'audio' | 'document'>([
  ['image/jpeg', 'image'], ['image/png', 'image'], ['image/webp', 'image'], ['image/gif', 'image'],
  ['video/mp4', 'video'], ['video/webm', 'video'], ['audio/mpeg', 'audio'], ['audio/ogg', 'audio'], ['audio/webm', 'audio'], ['audio/mp4', 'audio'],
  ['application/pdf', 'document'], ['text/plain', 'document'], ['text/csv', 'document'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'document'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'document'],
])
export const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 255)
