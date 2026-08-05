import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const polls = sqliteTable('polls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  final_option_id: integer('final_option_id'),
  created_at: text('created_at').notNull(),
  closed_at: text('closed_at'),
})

// Accounts are invite-only: the admin creates the row, then hands out
// an invite link. `username`/`password_hash`/`activated_at` stay null
// until the person accepts the invite and picks their credentials.
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    first_name: text('first_name').notNull(),
    last_name: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    description: text('description'),
    // Opt-in for e-mail notifications about calendar changes
    // (Vereinstermine, Mitglieder-Einträge, Reservierungen).
    notify_calendar_email: integer('notify_calendar_email', { mode: 'boolean' })
      .notNull()
      .default(false),
    // Grants the right to accept (approve) uploaded bills in the Kassa
    // (bookkeeping) module. Admins may approve regardless of this flag;
    // members need it explicitly. Admin-assignable in the user editor.
    is_kassier: integer('is_kassier', { mode: 'boolean' })
      .notNull()
      .default(false),
    username: text('username'),
    password_hash: text('password_hash'),
    role: text('role', { enum: ['member', 'admin'] })
      .notNull()
      .default('member'),
    activated_at: text('activated_at'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('users_username_unique').on(t.username)],
)

/**
 * Single-use auth tokens: invite links (14 days) and magic sign-in
 * links (15 minutes). Like share tokens, only the SHA-256 hash is
 * stored; the plaintext lives solely in the link.
 */
export const auth_tokens = sqliteTable('auth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull().unique(),
  purpose: text('purpose', { enum: ['invite', 'magic_link'] }).notNull(),
  created_at: text('created_at').notNull(),
  expires_at: text('expires_at').notNull(),
  used_at: text('used_at'),
})

// Fixed-window rate limiting for the auth endpoints (failed logins,
// magic-link requests), keyed by IP + bucket name.
export const auth_rate_limits = sqliteTable(
  'auth_rate_limits',
  {
    ip: text('ip').notNull(),
    bucket: text('bucket').notNull(),
    window_start: text('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ip, t.bucket] })],
)

/**
 * A folder in the shared documents area. Self-referencing via
 * `parent_id` — like `carried_from_task_id` on `event_tasks`, we
 * model self-references as a plain integer (not a drizzle `.references()`)
 * because self-referencing FKs break drizzle-kit's snapshotter; the
 * query layer validates the target exists and rejects cycles.
 * `parent_id = null` means the folder lives at the root.
 */
export const document_folders = sqliteTable('document_folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  parent_id: integer('parent_id'),
  created_by_user_id: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  created_by_name: text('created_by_name').notNull(),
  created_at: text('created_at').notNull(),
})

/**
 * Shared documents for signed-in members (statutes, protocols,
 * forms, …). Bytes live in R2 under `r2_key`; `uploaded_by_name`
 * is snapshotted so the list survives user deletion. `folder_id`
 * null means the document lives at the root of the shared area.
 */
export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  filename: text('filename').notNull(),
  content_type: text('content_type').notNull(),
  size: integer('size').notNull(),
  r2_key: text('r2_key').notNull().unique(),
  description: text('description'),
  folder_id: integer('folder_id').references(() => document_folders.id, {
    onDelete: 'set null',
  }),
  uploaded_by_user_id: integer('uploaded_by_user_id').references(
    () => users.id,
    { onDelete: 'set null' },
  ),
  uploaded_by_name: text('uploaded_by_name').notNull(),
  created_at: text('created_at').notNull(),
})

/**
 * A share link for a single document or an entire folder — exactly
 * one of `document_id` / `folder_id` is set (enforced at the query
 * layer, D1 has no partial-unique/check-constraint ergonomics worth
 * fighting for a two-column pair). A folder token grants access to
 * every document nested under that folder, recursively. Mirrors
 * `event_share_tokens`: only the SHA-256 hash is ever persisted.
 */
export const document_share_tokens = sqliteTable('document_share_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token_hash: text('token_hash').notNull().unique(),
  document_id: integer('document_id').references(() => documents.id, {
    onDelete: 'cascade',
  }),
  folder_id: integer('folder_id').references(() => document_folders.id, {
    onDelete: 'cascade',
  }),
  label: text('label'),
  created_at: text('created_at').notNull(),
  // ISO date string (YYYY-MM-DD) or null = never expires.
  expires_at: text('expires_at'),
  revoked_at: text('revoked_at'),
  last_hit_at: text('last_hit_at'),
})

export const poll_options = sqliteTable('poll_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  poll_id: integer('poll_id')
    .notNull()
    .references(() => polls.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  date: text('date').notNull(),
  time: text('time'),
  sort_order: integer('sort_order').notNull().default(0),
})

export const votes = sqliteTable(
  'votes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    poll_id: integer('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    option_id: integer('option_id')
      .notNull()
      .references(() => poll_options.id, { onDelete: 'cascade' }),
    voter_name: text('voter_name').notNull(),
    response: text('response', { enum: ['yes', 'no', 'maybe'] }).notNull(),
    comment: text('comment'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('votes_unique_per_voter').on(
      t.poll_id,
      t.voter_name,
      t.option_id,
    ),
  ],
)

export const ip_vote_counts = sqliteTable(
  'ip_vote_counts',
  {
    ip: text('ip').notNull(),
    poll_id: integer('poll_id').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ip, t.poll_id] })],
)

// ---------------------------------------------------------------------------
// Events: a single scheduled meeting (created by the admin from a locked poll
// or directly). Holds attendance, agenda items, and transcription.
// ---------------------------------------------------------------------------

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  poll_id: integer('poll_id').references(() => polls.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  scheduled_date: text('scheduled_date').notNull(),
  scheduled_time: text('scheduled_time'),
  location: text('location'),
  agenda: text('agenda'),
  transcription: text('transcription'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// Planned (= invited) attendees. The admin populates this when preparing
// the event; it does not require a real User row — we keep it as a free-form
// name string so the same workflow works for "Bringt Oma mit" style entries.
export const event_planned_attendees = sqliteTable('event_planned_attendees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
})

// Actual attendance recorded at the meeting. We snapshot the name so the
// list survives even if the linked user is deleted.
export const event_actual_attendees = sqliteTable('event_actual_attendees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
})

// An agenda item. `status` is one of "open" | "discussed" | "skipped".
// `notes` is the free-form discussion outcome. `sort_order` lets the admin
// reorder the agenda; updates rewrite the entire order via the service.
export const event_agenda_items = sqliteTable('event_agenda_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  notes: text('notes'),
  status: text('status', {
    enum: ['open', 'discussed', 'skipped'],
  })
    .notNull()
    .default('open'),
  sort_order: integer('sort_order').notNull().default(0),
})

// An agenda vote. `vote_type` is "yn" (yes/no) or "options" (free-form list).
// `counting_mode` is "anonymous" (the transcriber enters counts directly) or
// "per_attendee" (each present attendee casts a vote via the join table).
export const event_agenda_votes = sqliteTable('event_agenda_votes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agenda_item_id: integer('agenda_item_id')
    .notNull()
    .references(() => event_agenda_items.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  vote_type: text('vote_type', { enum: ['yn', 'options'] }).notNull(),
  counting_mode: text('counting_mode', {
    enum: ['anonymous', 'per_attendee'],
  }).notNull(),
  result_note: text('result_note'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// Options for an agenda vote. For `vote_type='yn'` the two rows are
// "Ja" / "Nein" and `count` holds the tally. For `per_attendee` votes
// `count` stays at zero — the attendee_votes join table is the source
// of truth. `label` is editable for `vote_type='options'` only.
export const event_agenda_vote_options = sqliteTable(
  'event_agenda_vote_options',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vote_id: integer('vote_id')
      .notNull()
      .references(() => event_agenda_votes.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    count: integer('count').notNull().default(0),
    sort_order: integer('sort_order').notNull().default(0),
  },
)

// Per-attendee vote responses. Only populated for `counting_mode='per_attendee'`.
// `option_id` is nullable for y/n votes where the response is stored as a
// boolean `response` (true=ja, false=nein) so we don't need the Ja/Nein rows.
export const event_attendee_votes = sqliteTable(
  'event_attendee_votes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vote_id: integer('vote_id')
      .notNull()
      .references(() => event_agenda_votes.id, { onDelete: 'cascade' }),
    attendee_id: integer('attendee_id')
      .notNull()
      .references(() => event_actual_attendees.id, { onDelete: 'cascade' }),
    option_id: integer('option_id').references(
      () => event_agenda_vote_options.id,
      { onDelete: 'cascade' },
    ),
    response: integer('response', { mode: 'boolean' }),
  },
  (t) => [
    uniqueIndex('event_attendee_votes_unique').on(t.vote_id, t.attendee_id),
  ],
)

// A file attached to an event, optionally scoped to a single agenda item.
// The actual bytes live in Cloudflare R2 under `r2_key`; this row is
// the metadata + pointer. We snapshot `filename` and `content_type` so
// download responses still work even if the R2 object metadata is
// missing (which can happen on cross-bucket restores).
export const event_attachments = sqliteTable('event_attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  agenda_item_id: integer('agenda_item_id').references(
    () => event_agenda_items.id,
    { onDelete: 'cascade' },
  ),
  filename: text('filename').notNull(),
  content_type: text('content_type').notNull(),
  size: integer('size').notNull(),
  r2_key: text('r2_key').notNull().unique(),
  caption: text('caption'),
  uploaded_by_user_id: integer('uploaded_by_user_id').references(
    () => users.id,
    { onDelete: 'set null' },
  ),
  created_at: text('created_at').notNull(),
})

/**
 * A formal decision / Beschluss adopted at the event. The resolution
 * number ("B-2026-001") is auto-assigned per calendar year. The
 * proposer and seconder are stored as either a user FK (preferred,
 * rendered with the user's full name) or a free-text name fallback
 * (for guests / one-time attendees not in the users table). An
 * optional `vote_id` links the decision to a specific agenda vote;
 * the PDF reads the vote state live at render time, not via a copy.
 */
export const event_decisions = sqliteTable('event_decisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  agenda_item_id: integer('agenda_item_id').references(
    () => event_agenda_items.id,
    { onDelete: 'set null' },
  ),
  // "B-2026-001" — auto-assigned by the server. Unique on its own so
  // a copy-paste of a historical decision can't collide accidentally.
  resolution_number: text('resolution_number').notNull().unique(),
  wording: text('wording').notNull(),
  proposer_user_id: integer('proposer_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  proposer_name: text('proposer_name'),
  seconder_user_id: integer('seconder_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  seconder_name: text('seconder_name'),
  vote_id: integer('vote_id').references(() => event_agenda_votes.id, {
    onDelete: 'set null',
  }),
  result_note: text('result_note'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

/**
 * A task / "Wer macht was bis wann?" arising from the event. The
 * owner is stored as either a user FK (preferred) or a free-text
 * name fallback. Carrying a task over to the next meeting creates a
 * new task row in the new event with `carried_from_event_id` and
 * `carried_from_task_id` pointing at the original; the old row
 * stays in its event so the past event's protocol still reflects
 * what was open at the time.
 */
export const event_tasks = sqliteTable('event_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  agenda_item_id: integer('agenda_item_id').references(
    () => event_agenda_items.id,
    { onDelete: 'set null' },
  ),
  title: text('title').notNull(),
  owner_user_id: integer('owner_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  owner_name: text('owner_name'),
  due_date: text('due_date'),
  status: text('status', { enum: ['open', 'done'] })
    .notNull()
    .default('open'),
  carried_from_event_id: integer('carried_from_event_id').references(
    () => events.id,
    { onDelete: 'set null' },
  ),
  // Self-reference on event_tasks breaks drizzle-kit's snapshotter,
  // so we model it as a plain integer and validate the target
  // exists at the query layer.
  carried_from_task_id: integer('carried_from_task_id'),
  notes: text('notes'),
  sort_order: integer('sort_order').notNull().default(0),
  completed_at: text('completed_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

/**
 * A share token that lets anyone with the link view a read-only
 * snapshot of the event — useful for distributing the agenda to
 * attendees before the meeting. We store the SHA-256 hash of the
 * token, not the token itself, so a database leak doesn't expose
 * existing share links. Tokens can expire and can be revoked.
 */
export const event_share_tokens = sqliteTable('event_share_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  // SHA-256 of the raw token, hex-encoded (64 chars). We index this
  // for O(1) public-lookup.
  token_hash: text('token_hash').notNull().unique(),
  // Optional admin-set label so the admin can distinguish multiple
  // share links for the same event ("Vorstand", "Newsletter", …).
  label: text('label'),
  created_at: text('created_at').notNull(),
  // ISO date string (YYYY-MM-DD) or null = never expires.
  expires_at: text('expires_at'),
  // ISO timestamp; null = still active.
  revoked_at: text('revoked_at'),
  // Last time the public endpoint validated this token. Useful for
  // the admin to see "yes, the link worked" without storing any PII.
  last_hit_at: text('last_hit_at'),
})

/**
 * Audit log of public share-page hits. Records the token (FK) and
 * the timestamp so the admin can see usage patterns. No IP, no
 * User-Agent, no other PII.
 */
export const event_share_views = sqliteTable('event_share_views', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token_id: integer('token_id')
    .notNull()
    .references(() => event_share_tokens.id, { onDelete: 'cascade' }),
  viewed_at: text('viewed_at').notNull(),
})

/**
 * A share token that grants access to view and vote on a single poll
 * without logging in — for inviting non-members to a specific
 * Terminabstimmung. Mirrors `event_share_tokens`: only the SHA-256
 * hash is ever persisted.
 */
export const poll_share_tokens = sqliteTable('poll_share_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  poll_id: integer('poll_id')
    .notNull()
    .references(() => polls.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull().unique(),
  label: text('label'),
  created_at: text('created_at').notNull(),
  expires_at: text('expires_at'),
  revoked_at: text('revoked_at'),
  last_hit_at: text('last_hit_at'),
})

export const poll_share_views = sqliteTable('poll_share_views', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token_id: integer('token_id')
    .notNull()
    .references(() => poll_share_tokens.id, { onDelete: 'cascade' }),
  viewed_at: text('viewed_at').notNull(),
})

// ---------------------------------------------------------------------------
// Calendar: member-created entries and exclusive property reservations,
// shown together with the admin-managed Vereinstermine (`events`) in the
// member calendar and the personal iCal feed.
// ---------------------------------------------------------------------------

/**
 * A member-created calendar entry — distinct from the admin-managed
 * `events` (Vereinstermine). Dates/times are Vienna wall time in the
 * app's text conventions (YYYY-MM-DD / HH:mm). `end_date = null`
 * means single-day, `start_time = null` means all-day. The creator
 * name is snapshotted so entries survive user deletion (same pattern
 * as documents).
 */
export const calendar_events = sqliteTable('calendar_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  start_date: text('start_date').notNull(),
  end_date: text('end_date'),
  start_time: text('start_time'),
  end_time: text('end_time'),
  created_by_user_id: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  created_by_name: text('created_by_name').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

/**
 * An exclusive reservation of the property, with or without an
 * overnight stay. `start_at` /
 * `end_at` are normalized ISO-UTC instants (always written via dayjs
 * `.toISOString()`), so lexicographic comparison in SQL is a correct
 * instant comparison. Vienna wall times are derived via
 * `_lib/booking.ts` — never stored. `billed_days` is computed
 * server-side on every write (day count per Vereinsstatuten; no
 * money amounts in the app). Cancel is soft (`status` +
 * `cancelled_at`) so notifications and audit keep working.
 */
export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  user_name: text('user_name').notNull(),
  start_at: text('start_at').notNull(),
  end_at: text('end_at').notNull(),
  billed_days: integer('billed_days').notNull(),
  note: text('note'),
  status: text('status', { enum: ['confirmed', 'cancelled'] })
    .notNull()
    .default('confirmed'),
  cancelled_at: text('cancelled_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

/**
 * Personal iCal feed token — exactly one active row per user (unique
 * index). Mirrors the share-token pattern: only the SHA-256 hash is
 * stored, the plaintext lives solely in the feed URL. Rotate =
 * delete + insert; revoke = delete.
 */
export const calendar_feed_tokens = sqliteTable(
  'calendar_feed_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_hash: text('token_hash').notNull().unique(),
    created_at: text('created_at').notNull(),
    last_used_at: text('last_used_at'),
  },
  (t) => [uniqueIndex('calendar_feed_tokens_user_unique').on(t.user_id)],
)

// ---------------------------------------------------------------------------
// Kassa / bookkeeping: uploaded bills (expenses), the members picked to bear a
// bill, the per-bill split shares snapshotted at approval, the manual
// Vereinskonto movements (opening balance, income, reimbursements) and the
// member-to-member paybacks. All amounts are integer euro cents.
// ---------------------------------------------------------------------------

/**
 * A single uploaded bill (Rechnung). Any member may create one; it
 * stays `pending` until a Kassier (or admin) approves or rejects it.
 * Only `approved` rows affect the ledger. `paid_from` records who
 * actually paid (the Vereinskonto or a member privately), while
 * `settlement` records who should bear the cost: the Vereinskassa,
 * split equally across all members, or split across the members
 * selected in `expense_debtors`. The optional receipt scan lives in R2
 * under `receipt_r2_key`; the payer/submitter names are snapshotted so
 * the row survives user deletion (same pattern as documents and
 * bookings).
 */
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  description: text('description').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  // Vienna wall date (YYYY-MM-DD) the purchase was made.
  expense_date: text('expense_date').notNull(),
  type: text('type', {
    enum: ['expected', 'emergency', 'project'],
  }).notNull(),
  category: text('category', {
    enum: [
      'huetten',
      'rasenflaeche',
      'anbauflaeche',
      'wildflaeche',
      'betriebskosten',
      'sonstiges',
    ],
  }).notNull(),
  cadence: text('cadence', { enum: ['regular', 'one_time'] }).notNull(),
  // Only meaningful when `type = 'project'`.
  project_name: text('project_name'),
  paid_from: text('paid_from', { enum: ['verein', 'member'] }).notNull(),
  paid_by_user_id: integer('paid_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  paid_by_name: text('paid_by_name'),
  settlement: text('settlement', {
    enum: ['verein', 'split', 'selected'],
  }).notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  receipt_r2_key: text('receipt_r2_key').unique(),
  receipt_filename: text('receipt_filename'),
  receipt_content_type: text('receipt_content_type'),
  receipt_size: integer('receipt_size'),
  submitted_by_user_id: integer('submitted_by_user_id').references(
    () => users.id,
    { onDelete: 'set null' },
  ),
  submitted_by_name: text('submitted_by_name').notNull(),
  reviewed_by_user_id: integer('reviewed_by_user_id').references(
    () => users.id,
    { onDelete: 'set null' },
  ),
  reviewed_by_name: text('reviewed_by_name'),
  reviewed_at: text('reviewed_at'),
  review_note: text('review_note'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

/**
 * The members picked to bear a `settlement = 'selected'` bill, stored
 * from the moment the bill is created (the shares themselves are only
 * materialized on approval). Rows are replaced wholesale when the
 * selection is edited and are irrelevant for the other settlements.
 */
export const expense_debtors = sqliteTable(
  'expense_debtors',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    expense_id: integer('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    user_id: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    member_name: text('member_name').notNull(),
  },
  (t) => [uniqueIndex('expense_debtors_unique').on(t.expense_id, t.user_id)],
)

/**
 * The split of a `settlement = 'split'` or `'selected'` expense across
 * members, materialized when the bill is approved so the per-member
 * debt is frozen at that moment — later membership changes must not
 * shift historical shares. `share_cents` sums back to the expense
 * amount (the remainder is assigned deterministically). The member name
 * is snapshotted so the row survives user deletion. The creditor is the
 * bill's payer: the member who fronted it, or the Vereinskassa.
 */
export const expense_shares = sqliteTable(
  'expense_shares',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    expense_id: integer('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    user_id: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    member_name: text('member_name').notNull(),
    share_cents: integer('share_cents').notNull(),
  },
  (t) => [uniqueIndex('expense_shares_unique').on(t.expense_id, t.user_id)],
)

/**
 * Manual Vereinskonto movements that don't originate from a bill:
 * the opening balance, incoming money (membership fees, donations, a
 * member paying back their split share), and reimbursements paid out
 * to a member who fronted money. `amount_cents` is always positive;
 * the sign of its effect on the balance is derived from `kind`
 * (opening/income add, reimbursement subtracts). `member_user_id`
 * attributes the entry to a member for the "who owes whom" view
 * (required for reimbursements). Only a Kassier/admin records these.
 */
export const bank_entries = sqliteTable('bank_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', {
    enum: ['opening', 'income', 'reimbursement'],
  }).notNull(),
  amount_cents: integer('amount_cents').notNull(),
  entry_date: text('entry_date').notNull(),
  description: text('description'),
  member_user_id: integer('member_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  member_name: text('member_name'),
  recorded_by_user_id: integer('recorded_by_user_id').references(
    () => users.id,
    { onDelete: 'set null' },
  ),
  recorded_by_name: text('recorded_by_name').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

/**
 * A payback from one member directly to another (Splitwise style):
 * someone who owes a share of a bill a fellow member fronted hands
 * over money outside the Vereinskonto. Never touches the Vereinskonto
 * balance — it only settles the debt between the two members.
 * `amount_cents` is always positive; both names are snapshotted so the
 * row survives user deletion.
 */
export const member_payments = sqliteTable('member_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  from_user_id: integer('from_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  from_name: text('from_name').notNull(),
  to_user_id: integer('to_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  to_name: text('to_name').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  payment_date: text('payment_date').notNull(),
  description: text('description'),
  recorded_by_user_id: integer('recorded_by_user_id').references(
    () => users.id,
    { onDelete: 'set null' },
  ),
  recorded_by_name: text('recorded_by_name').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// Tasks / Aufgaben: a shared member to-do board. Every signed-in member may
// create tasks; a task can be a one-off or an occurrence generated from a
// recurring series (`task_series`). Sub-tasks are a simple checklist. All
// creator/assignee names are snapshotted so rows survive user deletion (same
// pattern as documents, bookings, and the Kassa module).
// ---------------------------------------------------------------------------

/**
 * A recurring task template. Occurrences are materialized lazily (no cron):
 * whenever the task list is loaded, every active series whose
 * `next_occurrence_date` has arrived spawns a concrete `tasks` row and the
 * date is advanced by one interval. Deleting a series stops the recurrence;
 * already-generated tasks keep working (their `series_id` is set null).
 */
export const task_series = sqliteTable('task_series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  // The state each freshly generated occurrence starts in.
  state: text('state', {
    enum: [
      'idee',
      'planung',
      'ausfuehrung',
      'blockiert',
      'abgeschlossen',
      'abgebrochen',
    ],
  })
    .notNull()
    .default('idee'),
  price_estimate_cents: integer('price_estimate_cents'),
  assignee_user_id: integer('assignee_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  assignee_name: text('assignee_name'),
  interval_count: integer('interval_count').notNull(),
  interval_unit: text('interval_unit', {
    enum: ['day', 'week', 'month'],
  }).notNull(),
  // Vienna wall date (YYYY-MM-DD) of the next occurrence to spawn.
  next_occurrence_date: text('next_occurrence_date').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  created_by_user_id: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  created_by_name: text('created_by_name').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  state: text('state', {
    enum: [
      'idee',
      'planung',
      'ausfuehrung',
      'blockiert',
      'abgeschlossen',
      'abgebrochen',
    ],
  })
    .notNull()
    .default('idee'),
  price_estimate_cents: integer('price_estimate_cents'),
  // Vienna wall date (YYYY-MM-DD) or null = no due date.
  due_date: text('due_date'),
  assignee_user_id: integer('assignee_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  assignee_name: text('assignee_name'),
  // The recurring series this task was generated from, or null for a
  // one-off. Set null (not cascade) so stopping a series keeps its
  // already-created tasks around.
  series_id: integer('series_id').references(() => task_series.id, {
    onDelete: 'set null',
  }),
  created_by_user_id: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  created_by_name: text('created_by_name').notNull(),
  completed_at: text('completed_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

/**
 * A checklist item. Belongs to exactly one of a concrete `task` (a real
 * checklist entry with a `done` state) or a `task_series` (a template copied
 * onto every generated occurrence; `done` is ignored there). Exactly one of
 * `task_id` / `series_id` is set — enforced at the query layer, mirroring the
 * `document_share_tokens` pattern.
 */
export const task_subtasks = sqliteTable('task_subtasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  task_id: integer('task_id').references(() => tasks.id, {
    onDelete: 'cascade',
  }),
  series_id: integer('series_id').references(() => task_series.id, {
    onDelete: 'cascade',
  }),
  title: text('title').notNull(),
  description: text('description'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  sort_order: integer('sort_order').notNull().default(0),
})

// Inferred row types for query returns and route-handler response
// shapes. `token_hash` never leaves the server — the admin routes
// expose a short fingerprint instead.
export type EventShareTokenRow = typeof event_share_tokens.$inferSelect
export type EventShareViewRow = typeof event_share_views.$inferSelect
export type DocumentShareTokenRow = typeof document_share_tokens.$inferSelect
export type PollShareTokenRow = typeof poll_share_tokens.$inferSelect
export type CalendarEventRow = typeof calendar_events.$inferSelect
export type BookingRow = typeof bookings.$inferSelect
export type CalendarFeedTokenRow = typeof calendar_feed_tokens.$inferSelect
export type ExpenseRow = typeof expenses.$inferSelect
export type ExpenseShareRow = typeof expense_shares.$inferSelect
export type BankEntryRow = typeof bank_entries.$inferSelect
export type MemberPaymentRow = typeof member_payments.$inferSelect
export type TaskSeriesRow = typeof task_series.$inferSelect
export type TaskRow = typeof tasks.$inferSelect
export type TaskSubtaskRow = typeof task_subtasks.$inferSelect
