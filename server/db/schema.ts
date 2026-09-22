import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const attributeType = pgEnum('attribute_type', [
  'text',
  'number',
  'ordered',
  'multiple',
  'text-group',
  'boolean',
])

export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'blocked',
])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarColor: varchar('avatar_color', { length: 20 }).notNull(),
  avatarImageUrl: text('avatar_image_url'),
  emailVerified: boolean('email_verified').notNull().default(false),
  verificationToken: text('verification_token'),
  verificationTokenExpires: timestamp('verification_token_expires'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpires: timestamp('password_reset_expires'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
  usernameIdx: uniqueIndex('users_username_idx').on(t.username),
}))

// "games" unifie ce qui était séparé dans l'ancienne version (animes
// officiels en JSON vs table `custom_dles`) : un seul concept, un
// `owner_id` nul pour le contenu officiel et renseigné pour un DLE custom
// (voir server/api/games/index.post.ts).
export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 60 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  iconUrl: text('icon_url'),
  iconPublicId: text('icon_public_id'),
  backgroundUrl: text('background_url'),
  backgroundPublicId: text('background_public_id'),
  maxAttempts: integer('max_attempts').notNull().default(20),
  isOfficial: boolean('is_official').notNull().default(true),
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  visibility: varchar('visibility', { length: 20 }).notNull().default('public'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  slugIdx: uniqueIndex('games_slug_idx').on(t.slug),
}))

export const attributes = pgTable('attributes', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 40 }).notNull(),
  label: varchar('label', { length: 60 }).notNull(),
  type: attributeType('type').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  // Valeurs d'ordre pour type "ordered" (ex: liste d'arcs dans l'ordre)
  orderValues: jsonb('order_values').$type<string[]>(),
  // Suggestions affichées dans la section indices
  hints: jsonb('hints').$type<string[]>(),
  // Regroupements pour type "text-group" (valeurs considérées "proches")
  groups: jsonb('groups').$type<string[][]>(),
})

export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  imageUrl: text('image_url').notNull(),
  imagePublicId: text('image_public_id'),
  // Map clé d'attribut -> valeur (string | number | string[] | boolean),
  // validée à l'écriture contre les `attributes` du jeu (Zod dynamique).
  // JSONB plutôt qu'une table EAV : les valeurs sont toujours lues avec
  // le personnage entier, jamais filtrées côté SQL — l'EAV n'apporterait
  // que du coût de jointure sans bénéfice ici.
  attributes: jsonb('attributes').notNull().$type<Record<string, unknown>>(),
})

export const userGameStats = pgTable('user_game_stats', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  gamesPlayed: integer('games_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  maxStreak: integer('max_streak').notNull().default(0),
  totalAttempts: integer('total_attempts').notNull().default(0),
  // Le moins d'essais jamais fait pour une victoire sur ce jeu — null tant
  // qu'aucune victoire n'a été enregistrée.
  bestAttempts: integer('best_attempts'),
  dailyPlayed: integer('daily_played').notNull().default(0),
  dailyWins: integer('daily_wins').notNull().default(0),
  dailyStreak: integer('daily_streak').notNull().default(0),
  dailyMaxStreak: integer('daily_max_streak').notNull().default(0),
  lastDailyDate: varchar('last_daily_date', { length: 10 }),
  multiplayerPlayed: integer('multiplayer_played').notNull().default(0),
  multiplayerWins: integer('multiplayer_wins').notNull().default(0),
}, (t) => ({
  userGameIdx: uniqueIndex('user_game_stats_user_game_idx').on(t.userId, t.gameId),
}))

export const friendships = pgTable('friendships', {
  id: serial('id').primaryKey(),
  requesterId: integer('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addresseeId: integer('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: friendshipStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  respondedAt: timestamp('responded_at'),
}, (t) => ({
  pairIdx: uniqueIndex('friendships_pair_idx').on(t.requesterId, t.addresseeId),
}))

export const favoriteGames = pgTable('favorite_games', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userGameIdx: uniqueIndex('favorite_games_user_game_idx').on(t.userId, t.gameId),
}))

// Un enregistrement par joueur/jeu/jour, distinct de `user_game_stats`
// (compteurs cumulés) — nécessaire pour classer le défi du jour par vitesse
// de résolution, pas seulement par nombre d'essais.
export const dailyCompletions = pgTable('daily_completions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(),
  attempts: integer('attempts').notNull(),
  won: boolean('won').notNull(),
  completedAt: timestamp('completed_at').notNull().defaultNow(),
}, (t) => ({
  userGameDateIdx: uniqueIndex('daily_completions_user_game_date_idx').on(t.userId, t.gameId, t.date),
}))

export const gamesRelations = relations(games, ({ many, one }) => ({
  attributes: many(attributes),
  characters: many(characters),
  owner: one(users, { fields: [games.ownerId], references: [users.id] }),
}))

export const attributesRelations = relations(attributes, ({ one }) => ({
  game: one(games, { fields: [attributes.gameId], references: [games.id] }),
}))

export const charactersRelations = relations(characters, ({ one }) => ({
  game: one(games, { fields: [characters.gameId], references: [games.id] }),
}))

export const usersRelations = relations(users, ({ many }) => ({
  stats: many(userGameStats),
  games: many(games),
}))

export const userGameStatsRelations = relations(userGameStats, ({ one }) => ({
  user: one(users, { fields: [userGameStats.userId], references: [users.id] }),
  game: one(games, { fields: [userGameStats.gameId], references: [games.id] }),
}))

export const dailyCompletionsRelations = relations(dailyCompletions, ({ one }) => ({
  user: one(users, { fields: [dailyCompletions.userId], references: [users.id] }),
  game: one(games, { fields: [dailyCompletions.gameId], references: [games.id] }),
}))

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, { fields: [friendships.requesterId], references: [users.id], relationName: 'requester' }),
  addressee: one(users, { fields: [friendships.addresseeId], references: [users.id], relationName: 'addressee' }),
}))
