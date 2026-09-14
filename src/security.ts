import type { PromptItem, PromptVariable } from "./types";

export const PROMPT_LIMITS = {
  maxPromptsPerUser: 500,
  maxImportBytes: 2_000_000,
  title: 200,
  description: 4_000,
  body: 100_000,
  folder: 100,
  tags: 20,
  tag: 100,
  aiTargets: 10,
  aiTarget: 100,
  variables: 50,
  variableName: 100,
  variableLabel: 200,
  variableValue: 20_000,
  variableOptions: 50,
  variableOption: 200,
  variablesJsonBytes: 64_000,
} as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, maxLength: number) {
  return (typeof value === "string" ? value : fallback).slice(0, maxLength);
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function dateText(value: unknown, fallback: string) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function normalizeVariable(value: unknown): PromptVariable | null {
  if (!isObject(value)) return null;
  const type = value.type === "textarea" || value.type === "select" ? value.type : "text";
  const name = text(value.name, "入力内容", PROMPT_LIMITS.variableName);
  if (!name) return null;
  const variable: PromptVariable = {
    name,
    label: text(value.label, name, PROMPT_LIMITS.variableLabel),
    type,
    value: text(value.value, "", PROMPT_LIMITS.variableValue),
  };
  if (type === "select") {
    variable.options = stringList(value.options, PROMPT_LIMITS.variableOptions, PROMPT_LIMITS.variableOption);
  }
  return variable;
}

export function normalizeImportedPrompt(value: unknown, userId?: string): PromptItem | null {
  if (!isObject(value)) return null;
  const now = new Date().toISOString();
  const title = text(value.title, "", PROMPT_LIMITS.title);
  const body = text(value.body, "", PROMPT_LIMITS.body);
  if (!title || !body) return null;

  const variables = (Array.isArray(value.variables) ? value.variables : [])
    .map(normalizeVariable)
    .filter((item): item is PromptVariable => Boolean(item))
    .slice(0, PROMPT_LIMITS.variables);

  return {
    id: typeof value.id === "string" && uuidPattern.test(value.id) ? value.id : crypto.randomUUID(),
    userId,
    title,
    description: text(value.description, "", PROMPT_LIMITS.description),
    body,
    folder: text(value.folder, "未分類", PROMPT_LIMITS.folder) || "未分類",
    tags: stringList(value.tags, PROMPT_LIMITS.tags, PROMPT_LIMITS.tag),
    aiTargets: stringList(value.aiTargets, PROMPT_LIMITS.aiTargets, PROMPT_LIMITS.aiTarget),
    isFavorite: value.isFavorite === true,
    variables,
    useCount: Number.isInteger(value.useCount) ? Math.max(0, Math.min(Number(value.useCount), 100_000_000)) : 0,
    version: Number.isInteger(value.version) ? Math.max(1, Math.min(Number(value.version), 1_000_000)) : 1,
    createdAt: dateText(value.createdAt, now),
    updatedAt: dateText(value.updatedAt, now),
    deletedAt: value.deletedAt === null ? null : dateText(value.deletedAt, "") || null,
  };
}

export function getPromptValidationError(prompt: PromptItem) {
  if (prompt.title.length > PROMPT_LIMITS.title) return `タイトルは${PROMPT_LIMITS.title}文字以内にしてください`;
  if (prompt.description.length > PROMPT_LIMITS.description) return `説明は${PROMPT_LIMITS.description}文字以内にしてください`;
  if (prompt.body.length > PROMPT_LIMITS.body) return `本文は${PROMPT_LIMITS.body.toLocaleString()}文字以内にしてください`;
  if (prompt.folder.length > PROMPT_LIMITS.folder) return `フォルダー名は${PROMPT_LIMITS.folder}文字以内にしてください`;
  if (prompt.tags.length > PROMPT_LIMITS.tags || prompt.tags.some((tag) => tag.length > PROMPT_LIMITS.tag)) return "タグが保存上限を超えています";
  if (prompt.aiTargets.length > PROMPT_LIMITS.aiTargets || prompt.aiTargets.some((target) => target.length > PROMPT_LIMITS.aiTarget)) return "AI対象が保存上限を超えています";
  if (prompt.variables.length > PROMPT_LIMITS.variables) return `変数は${PROMPT_LIMITS.variables}件以内にしてください`;
  if (new TextEncoder().encode(JSON.stringify(prompt.variables)).length > PROMPT_LIMITS.variablesJsonBytes) return "変数の内容が保存上限を超えています";
  return null;
}
