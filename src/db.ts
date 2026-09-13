import Dexie, { type EntityTable } from "dexie";
import type { PromptItem } from "./types";

class PromptShelfDB extends Dexie {
  prompts!: EntityTable<PromptItem, "id">;
  constructor() {
    super("prompt-shelf");
    this.version(1).stores({ prompts: "id, title, folder, isFavorite, updatedAt, deletedAt, *tags" });
  }
}
export const db = new PromptShelfDB();
