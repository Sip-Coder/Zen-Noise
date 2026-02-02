import { type UserSettings, type InsertUserSettings } from "@shared/schema";

export interface IStorage {
  // Define methods if we needed backend persistence, but we don't.
  // Keeping interface empty/minimal.
  getUserSettings(id: number): Promise<UserSettings | undefined>;
}

export class MemStorage implements IStorage {
  private settings: Map<number, UserSettings>;

  constructor() {
    this.settings = new Map();
  }

  async getUserSettings(id: number): Promise<UserSettings | undefined> {
    return this.settings.get(id);
  }
}

export const storage = new MemStorage();
