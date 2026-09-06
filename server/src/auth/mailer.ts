import nodemailer from 'nodemailer'
import { env } from '../env.js'

export async function sendAccountEmail(to: string, subject: string, actionUrl: string) {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV === 'production') throw new Error('SMTP is not configured')
    return
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text: `${subject}: ${actionUrl}` })
}
