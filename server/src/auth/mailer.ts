import nodemailer from 'nodemailer'
import { env } from '../env.js'
import { HTTPException } from 'hono/http-exception'

export function requireMailConfiguration() {
  if (!env.SMTP_HOST) throw new HTTPException(503, { message: 'Email service is unavailable. Please try again later.' })
}

export async function sendAccountEmail(to: string, subject: string, actionUrl: string) {
  requireMailConfiguration()
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.NODE_ENV === 'production' && env.SMTP_PORT !== 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text: `${subject}: ${actionUrl}` })
}
