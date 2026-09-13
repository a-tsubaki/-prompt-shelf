export type PromptVariable = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  value: string;
  options?: string[];
};

export type PromptItem = {
  id: string;
  userId?: string;
  title: string;
  description: string;
  body: string;
  folder: string;
  tags: string[];
  aiTargets: string[];
  isFavorite: boolean;
  variables: PromptVariable[];
  useCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type SyncState = "local" | "syncing" | "synced" | "error";
