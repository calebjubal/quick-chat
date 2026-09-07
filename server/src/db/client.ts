import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.js'
import * as schema from './schema.js'

const sql = postgres(env.DATABASE_URL, { max: env.NODE_ENV === 'production' ? 20 : 5, prepare: false, connect_timeout: 10, idle_timeout: 20 })
export const db = drizzle(sql, { schema })
export const closeDatabase = () => sql.end()
