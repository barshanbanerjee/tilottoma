import { pgTable, text, timestamp, uuid, varchar, geometry, pgEnum } from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status', ['PENDING', 'APPROVED', 'REJECTED']);

export const streets = pgTable('streets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  geom: geometry('geom', { type: 'MultiLineString', srid: 4326 }).notNull(),
  status: statusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const historicalNames = pgTable('historical_names', {
  id: uuid('id').defaultRandom().primaryKey(),
  streetId: uuid('street_id').references(() => streets.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  validFrom: varchar('valid_from', { length: 255 }),
  validUntil: varchar('valid_until', { length: 255 }),
  explanation: text('explanation'),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sources = pgTable('sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  streetId: uuid('street_id').references(() => streets.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  author: varchar('author', { length: 255 }),
  publisher: varchar('publisher', { length: 255 }),
  url: varchar('url', { length: 255 }),
  publicationDate: varchar('publication_date', { length: 255 }),
  sourceType: varchar('source_type', { length: 255 }),
  citation: text('citation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
