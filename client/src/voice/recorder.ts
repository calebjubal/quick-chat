export const MAX_VOICE_SECONDS = 15 * 60
export const formatVoiceDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export class VoiceRecorder {
  private recorder?: MediaRecorder
  private stream?: MediaStream
  private chunks: Blob[] = []
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    this.recorder = new MediaRecorder(this.stream, { mimeType }); this.chunks = []
    this.recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data) }
    this.recorder.start(250)
  }
  stop() { return new Promise<Blob>((resolve, reject) => { if (!this.recorder) return reject(new Error('No active recording')); this.recorder.onstop = () => { this.stream?.getTracks().forEach((track) => track.stop()); resolve(new Blob(this.chunks, { type: this.recorder?.mimeType })) }; this.recorder.stop() }) }
  cancel() { if (this.recorder?.state && this.recorder.state !== 'inactive') this.recorder.stop(); this.stream?.getTracks().forEach((track) => track.stop()); this.chunks = [] }
}
