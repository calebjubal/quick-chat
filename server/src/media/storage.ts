import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../env.js'

export const storage = new S3Client({ region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: Boolean(env.S3_ENDPOINT), credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined })
export const uploadUrl = (key: string, mime: string, size: number) => getSignedUrl(storage, new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: mime, ContentLength: size }), { expiresIn: 600 })
export const downloadUrl = (key: string) => getSignedUrl(storage, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 300 })
export const inspectObject = (key: string) => storage.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
