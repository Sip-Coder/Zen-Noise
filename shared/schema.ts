import { pgTable, text, serial, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// NOTE: This app is client-side only (No Database).
// These schemas are defined primarily to satisfy the project structure
// and could be used for local storage validation.

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  volume: integer("volume").notNull().default(50),
  waveIntensity: text("wave_intensity").notNull().default("off"), // off, low, medium
  timerDuration: integer("timer_duration").notNull().default(0), // 0 means infinite
});

export const insertUserSettingsSchema = createInsertSchema(userSettings);

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
