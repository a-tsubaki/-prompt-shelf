import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, projectRoot), "utf8");
}

test("public client has a restrictive content security policy", async () => {
  const html = await read("index.html");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'self' https:\/\/clsborqvtjgepodgcrjr\.supabase\.co wss:\/\/clsborqvtjgepodgcrjr\.supabase\.co/);
  assert.match(html, /object-src 'none'/);
  assert.doesNotMatch(html, /unsafe-eval/);
});

test("database schema denies anonymous access and enforces ownership", async () => {
  const schema = await read("supabase/schema.sql");
  assert.match(schema, /alter table public\.prompts enable row level security/);
  assert.match(schema, /revoke all on public\.prompts from anon/);
  assert.equal((schema.match(/create policy /g) ?? []).length, 4);
  assert.ok((schema.match(/\(select auth\.uid\(\)\) = user_id/g) ?? []).length >= 5);
  assert.match(schema, /before insert on public\.prompts/);
  assert.match(schema, /prompt_count >= 500/);
});

test("frontend contains no privileged key markers", async () => {
  const paths = ["src/App.tsx", "src/supabase.ts", "src/security.ts", ".env.production"];
  const contents = await Promise.all(paths.map(read));
  const combined = contents.join("\n");
  assert.doesNotMatch(combined, /service_role|sb_secret_|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
});

test("Supabase client dependency is pinned", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.match(packageJson.dependencies["@supabase/supabase-js"], /^\d+\.\d+\.\d+$/);
});
