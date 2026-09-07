import { apiRequest, type Attachment } from './store'

type UploadOptions = { voice?: boolean; durationSeconds?: number; waveform?: number[]; onProgress?: (percent: number) => void }
type UploadRecord = Attachment & { status: 'pending' | 'quarantined' | 'ready' | 'rejected' }

export const normalizedMimeType = (file: Blob) => file.type.split(';')[0].trim().toLowerCase() || 'application/octet-stream'

const putFile = (url: string, file: Blob, mimeType: string, onProgress?: (percent: number) => void) => new Promise<void>((resolve, reject) => {
  const request = new XMLHttpRequest()
  request.open('PUT', url); request.setRequestHeader('content-type', mimeType)
  request.upload.onprogress = (event) => event.lengthComputable && onProgress?.(Math.round((event.loaded / event.total) * 100))
  request.onerror = () => reject(new Error('Upload interrupted. Please try again.'))
  request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('The storage service rejected this upload.'))
  request.send(file)
})

export async function uploadAttachment(file: File | Blob, fileName: string, options: UploadOptions = {}) {
  const mimeType = normalizedMimeType(file)
  const initiated = await apiRequest<{ attachment: UploadRecord; uploadUrl: string }>('/uploads', { method: 'POST', body: JSON.stringify({ fileName, mimeType, byteSize: file.size, voice: Boolean(options.voice), durationSeconds: options.durationSeconds, waveform: options.waveform }) })
  await putFile(initiated.uploadUrl, file, mimeType, options.onProgress)
  await apiRequest(`/uploads/${initiated.attachment.id}/finalize`, { method: 'POST' })
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const status = await apiRequest<{ attachment: UploadRecord }>(`/uploads/${initiated.attachment.id}`)
    if (status.attachment.status === 'ready') return { ...initiated.attachment, status: 'ready' as const }
    if (status.attachment.status === 'rejected') throw new Error('This upload did not pass the security scan.')
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
  }
  throw new Error('The upload is still being checked. Please try again shortly.')
}

export async function openAttachment(attachmentId: string) {
  const { url } = await apiRequest<{ url: string }>(`/uploads/${attachmentId}/download`)
  window.open(url, '_blank', 'noopener,noreferrer')
}
