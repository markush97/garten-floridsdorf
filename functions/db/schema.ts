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

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  description: text('description'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
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
