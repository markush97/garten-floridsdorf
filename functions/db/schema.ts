import {
  integer,
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
