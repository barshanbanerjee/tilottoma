import { pgTable, text, timestamp, uuid, varchar, geometry, pgEnum, jsonb, doublePrecision } from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status', ['PENDING', 'APPROVED', 'REJECTED']);
export const userRoleEnum = pgEnum('user_role', ['USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN']);
export const contributorRequestStatusEnum = pgEnum('contributor_request_status', ['NONE', 'REQUESTED', 'APPROVED', 'REJECTED']);
export const recommendationStatusEnum = pgEnum('recommendation_status', ['PENDING', 'APPROVED', 'REJECTED']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('USER').notNull(),
  contributorRequestStatus: contributorRequestStatusEnum('contributor_request_status').default('NONE').notNull(),
  contributorBio: text('contributor_bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const streets = pgTable('streets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  geom: geometry('geom', { type: 'MultiLineString', srid: 4326 }).notNull(),
  status: statusEnum('status').default('PENDING').notNull(),
  contributedById: uuid('contributed_by_id').references(() => users.id),
  contributorName: varchar('contributor_name', { length: 255 }),
  tags: jsonb('tags').$type<string[]>(),
  images: jsonb('images').$type<{ url: string; caption?: string; credit?: string }[]>(),
  blogLinks: jsonb('blog_links').$type<{ title: string; url: string; author?: string }[]>(),
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

export const recommendations = pgTable('recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  streetId: uuid('street_id').references(() => streets.id),
  zone: varchar('zone', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(), // 'Food & Adda', 'Heritage Sites', 'Culture & Books', 'Markets & Gems'
  description: text('description').notNull(),
  address: text('address'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  status: recommendationStatusEnum('status').default('PENDING').notNull(),
  contributedById: uuid('contributed_by_id').references(() => users.id),
  contributorName: varchar('contributor_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

