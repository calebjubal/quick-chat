import {
  bigint, boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text,
  timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const conversationType = pgEnum('conversation_type', ['direct', 'group', 'shared'])
export const accountKind = pgEnum('account_kind', ['registered', 'guest'])
export const memberRole = pgEnum('member_role', ['owner', 'admin', 'member'])
export const messageKind = pgEnum('message_kind', ['text', 'image', 'video', 'audio', 'voice', 'document', 'system'])
export const attachmentStatus = pgEnum('attachment_status', ['pending', 'quarantined', 'ready', 'rejected'])
export const accountTokenType = pgEnum('account_token_type', ['verify_email', 'reset_password'])
export const reportStatus = pgEnum('report_status', ['open', 'reviewed', 'closed'])
export const visibility = pgEnum('visibility', ['everyone', 'contacts', 'nobody'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull(),
  emailNormalized: varchar('email_normalized', { length: 320 }).notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  username: varchar('username', { length: 32 }),
  usernameNormalized: varchar('username_normalized', { length: 32 }),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  accountKind: accountKind('account_kind').default('registered').notNull(),
  about: varchar('about', { length: 160 }),
  avatarKey: text('avatar_key'),
  theme: varchar('theme', { length: 10 }).default('system').notNull(),
  readReceiptsEnabled: boolean('read_receipts_enabled').default(true).notNull(),
  lastSeenVisibility: visibility('last_seen_visibility').default('contacts').notNull(),
  deletionScheduledAt: timestamp('deletion_scheduled_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex('users_email_normalized_uq').on(table.emailNormalized), uniqueIndex('users_username_normalized_uq').on(table.usernameNormalized)])

export const credentials = pgTable('credentials', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  csrfHash: varchar('csrf_hash', { length: 64 }).notNull(),
  userAgent: varchar('user_agent', { length: 500 }),
  ipHash: varchar('ip_hash', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('sessions_token_hash_uq').on(table.tokenHash), index('sessions_user_active_idx').on(table.userId, table.expiresAt)])

export const accountTokens = pgTable('account_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: accountTokenType('type').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('account_tokens_hash_uq').on(table.tokenHash), index('account_tokens_user_type_idx').on(table.userId, table.type)])

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: conversationType('type').notNull(),
  title: varchar('title', { length: 120 }),
  avatarKey: text('avatar_key'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  nextSequence: bigint('next_sequence', { mode: 'number' }).default(1).notNull(),
  disappearingSeconds: integer('disappearing_seconds'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  ...timestamps,
})

export const directConversationPairs = pgTable('direct_conversation_pairs', {
  conversationId: uuid('conversation_id').primaryKey().references(() => conversations.id, { onDelete: 'cascade' }),
  firstUserId: uuid('first_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  secondUserId: uuid('second_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [uniqueIndex('direct_pair_uq').on(table.firstUserId, table.secondUserId)])

export const conversationMembers = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: memberRole('role').default('member').notNull(),
  nickname: varchar('nickname', { length: 80 }),
  lastDeliveredSequence: bigint('last_delivered_sequence', { mode: 'number' }).default(0).notNull(),
  lastReadSequence: bigint('last_read_sequence', { mode: 'number' }).default(0).notNull(),
  deletedThroughSequence: bigint('deleted_through_sequence', { mode: 'number' }).default(0).notNull(),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }),
  mutedUntil: timestamp('muted_until', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.conversationId, table.userId] }), index('members_user_inbox_idx').on(table.userId, table.archivedAt, table.pinnedAt)])

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  sequence: bigint('sequence', { mode: 'number' }).notNull(),
  kind: messageKind('kind').default('text').notNull(),
  body: text('body'),
  replyToId: uuid('reply_to_id'),
  forwarded: boolean('forwarded').default(false).notNull(),
  revision: integer('revision').default(1).notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  deletedForEveryoneAt: timestamp('deleted_for_everyone_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('messages_conversation_sequence_uq').on(table.conversationId, table.sequence), index('messages_conversation_created_idx').on(table.conversationId, table.createdAt), index('messages_expiry_idx').on(table.expiresAt)])

export const messageDeletions = pgTable('message_deletions', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.messageId, table.userId] })])

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 127 }).notNull(),
  kind: messageKind('kind').notNull(),
  byteSize: integer('byte_size').notNull(),
  status: attachmentStatus('status').default('pending').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('attachments_object_key_uq').on(table.objectKey), index('attachments_pending_idx').on(table.status, table.createdAt)])

export const reactions = pgTable('reactions', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.messageId, table.userId] })])

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('invites_token_hash_uq').on(table.tokenHash)])

export const blocks = pgTable('blocks', {
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })])

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedUserId: uuid('reported_user_id').references(() => users.id, { onDelete: 'set null' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  reason: varchar('reason', { length: 80 }).notNull(),
  detail: text('detail'),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().default({}).notNull(),
  status: reportStatus('status').default('open').notNull(),
  evidenceExpiresAt: timestamp('evidence_expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('reports_status_created_idx').on(table.status, table.createdAt)])

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpointHash: varchar('endpoint_hash', { length: 64 }).notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: varchar('user_agent', { length: 500 }),
  ...timestamps,
}, (table) => [uniqueIndex('push_endpoint_hash_uq').on(table.endpointHash), index('push_user_idx').on(table.userId)])

export const eventOutbox = pgTable('event_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  aggregateId: uuid('aggregate_id').notNull(),
  type: varchar('type', { length: 80 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => [index('event_outbox_unpublished_idx').on(table.publishedAt, table.createdAt)])
