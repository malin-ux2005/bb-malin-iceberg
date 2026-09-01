import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  eventDate: text('event_date'),
  links: text('links').notNull().default('[]'),
  x: real('x').notNull(),
  y: real('y').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  r2Key: text('r2_key').notNull(),
  createdAt: text('created_at').notNull(),
});
