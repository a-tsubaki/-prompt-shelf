import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Bell, BookmarkSimple, CaretDown, CheckCircle, Clock, CloudCheck, Copy, DotsThree, FileText, Folder, Funnel, Gear, GithubLogo, GoogleLogo, LockKey, MagnifyingGlass, Plus, ShieldCheck, SignOut, SortAscending, SpinnerGap, Star, Trash, X } from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { db } from "./db";
import { starterPrompts } from "./data";
import { getPromptValidationError, normalizeImportedPrompt, PROMPT_LIMITS } from "./security";
import { isSupabaseConfigured, signInWithProvider, supabase, type LoginProvider } from "./supabase";
import type { PromptItem, SyncState } from "./types";

type ViewMode = "all" | "favorites" | "recent" | "trash";
type DetailTab = "use" | "edit" | "history";
type AuthState = "checking" | "authenticated" | "unauthenticated";
const folders = ["文章作成", "画像生成", "物語・キャラクター", "企画・分析", "開発"];
const syncLabels: Record<SyncState, string> = { local: "ローカル保存", syncing: "同期中", synced: "同期済み", error: "同期エラー" };

function compilePrompt(prompt: PromptItem) {
  return prompt.variables.reduce((text, variable) => text.replaceAll(`{{${variable.name}}}`, variable.value || `［${variable.label}］`), prompt.body);
}
function relativeTime(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}分前`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}時間前` : `${Math.floor(hours / 24)}日前`;
}
function toCloud(prompt: PromptItem, userId: string) {
  return { id: prompt.id, user_id: userId, title: prompt.title, description: prompt.description, body: prompt.body, folder: prompt.folder, tags: prompt.tags, ai_targets: prompt.aiTargets, is_favorite: prompt.isFavorite, variables: prompt.variables, use_count: prompt.useCount, version: prompt.version, deleted_at: prompt.deletedAt || null, created_at: prompt.createdAt, updated_at: prompt.updatedAt };
}
function fromCloud(row: Record<string, any>): PromptItem {
  return { id: row.id, userId: row.user_id, title: row.title, description: row.description ?? "", body: row.body, folder: row.folder ?? "未分類", tags: row.tags ?? [], aiTargets: row.ai_targets ?? ["汎用"], isFavorite: row.is_favorite ?? false, variables: row.variables ?? [], useCount: row.use_count ?? 0, version: row.version ?? 1, deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function App() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedId, setSelectedId] = useState("story-structure");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("all");
  const [folder, setFolder] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("use");
  const [syncState, setSyncState] = useState<SyncState>(isSupabaseConfigured ? "syncing" : "local");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>(isSupabaseConfigured ? "checking" : "authenticated");
  const [authError, setAuthError] = useState("");
  const [loginProvider, setLoginProvider] = useState<LoginProvider | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loadingUser = useRef<string | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const clearPrivateCache = useCallback(async () => {
    setPrompts([]);
    setSelectedId("");
    setMobileDetail(false);
    await db.prompts.clear();
  }, []);

  const loadCloud = useCallback(async (id: string) => {
    if (!supabase) return;
    if (loadingUser.current === id) return;
    loadingUser.current = id;
    setSyncState("syncing");
    try {
      const { data, error } = await supabase.from("prompts").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      let cloudPrompts = (data ?? []).map(fromCloud);
      if (cloudPrompts.length === 0) {
        const seeded = starterPrompts.map((prompt) => ({ ...prompt, id: crypto.randomUUID(), userId: id }));
        const { error: seedError } = await supabase.from("prompts").insert(seeded.map((prompt) => toCloud(prompt, id)));
        if (seedError) throw seedError;
        cloudPrompts = seeded;
      }
      await db.prompts.clear();
      await db.prompts.bulkPut(cloudPrompts);
      setPrompts(cloudPrompts);
      setSelectedId(cloudPrompts[0]?.id ?? "");
      setSyncState("synced");
    } catch {
      await clearPrivateCache();
      setSyncState("error");
      flash("データを安全に読み込めませんでした");
    } finally {
      loadingUser.current = null;
    }
  }, [clearPrivateCache, flash]);

  useEffect(() => {
    if (!supabase) {
      async function bootLocal() {
        const count = await db.prompts.count();
        if (!count) await db.prompts.bulkPut(starterPrompts);
        setPrompts(await db.prompts.toArray());
      }
      void bootLocal();
      return;
    }

    let active = true;
    async function applyUser(nextUser: User | null) {
      if (!active) return;
      if (!nextUser) {
        setUser(null);
        setUserId(null);
        setAuthState("unauthenticated");
        setSyncState("local");
        await clearPrivateCache();
        return;
      }
      setUser(nextUser);
      setUserId(nextUser.id);
      setAuthError("");
      setAuthState("checking");
      await loadCloud(nextUser.id);
      if (active) setAuthState("authenticated");
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void applyUser(session?.user ?? null), 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [clearPrivateCache, loadCloud]);

  useEffect(() => {
    if (!supabase || !userId || authState !== "authenticated") return;
    const client = supabase;
    const channel = client.channel(`prompt-updates:${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "prompts", filter: `user_id=eq.${userId}` }, () => void loadCloud(userId)).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [authState, loadCloud, userId]);

  const persist = useCallback(async (prompt: PromptItem) => {
    const validationError = getPromptValidationError(prompt);
    if (validationError) {
      flash(validationError);
      return prompt;
    }
    const updated = { ...prompt, userId: userId ?? prompt.userId, updatedAt: new Date().toISOString(), version: prompt.version + 1 };
    setPrompts((items) => items.map((item) => item.id === updated.id ? updated : item));
    await db.prompts.put(updated);
    if (supabase && userId) {
      setSyncState("syncing");
      const { error } = await supabase.from("prompts").upsert(toCloud(updated, userId));
      setSyncState(error ? "error" : "synced");
      if (error) flash("クラウドへの保存に失敗しました");
    } else setSyncState("local");
    return updated;
  }, [flash, userId]);

  const filtered = useMemo(() => prompts
    .filter((prompt) => view === "trash" ? Boolean(prompt.deletedAt) : !prompt.deletedAt)
    .filter((prompt) => view !== "favorites" || prompt.isFavorite)
    .filter((prompt) => !folder || prompt.folder === folder)
    .filter((prompt) => !query.trim() || [prompt.title, prompt.description, prompt.body, ...prompt.tags].join(" ").toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => view === "recent" ? b.useCount - a.useCount : +new Date(b.updatedAt) - +new Date(a.updatedAt)), [folder, prompts, query, view]);

  const selected = prompts.find((prompt) => prompt.id === selectedId) ?? filtered[0];
  const completed = selected ? compilePrompt(selected) : "";
  const updateSelected = (changes: Partial<PromptItem>) => { if (selected) void persist({ ...selected, ...changes }); };
  async function copyText(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    if (selected) void persist({ ...selected, useCount: selected.useCount + 1 });
    flash(message);
  }
  async function beginLogin(provider: LoginProvider) {
    setAuthError("");
    setLoginProvider(provider);
    const { error } = await signInWithProvider(provider);
    if (error) {
      setAuthError("ログインを開始できませんでした。設定または通信状態をご確認ください。");
      setLoginProvider(null);
    }
  }
  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      flash("ログアウトできませんでした");
      return;
    }
    setMenuOpen(false);
    setAccountOpen(false);
  }
  async function addPrompt() {
    if (prompts.length >= PROMPT_LIMITS.maxPromptsPerUser) {
      flash(`保存できるプロンプトは${PROMPT_LIMITS.maxPromptsPerUser}件までです`);
      return;
    }
    const date = new Date().toISOString();
    const created: PromptItem = { id: crypto.randomUUID(), userId: userId ?? undefined, title: "無題のプロンプト", description: "新しいプロンプトの説明を入力してください。", body: "{{入力内容}}", folder: "文章作成", tags: ["新規"], aiTargets: ["汎用"], isFavorite: false, variables: [{ name: "入力内容", label: "入力内容", type: "textarea", value: "" }], useCount: 0, version: 1, createdAt: date, updatedAt: date };
    await db.prompts.put(created);
    if (supabase && userId) {
      const { error } = await supabase.from("prompts").insert(toCloud(created, userId));
      if (error) {
        await db.prompts.delete(created.id);
        flash("新しいプロンプトを作成できませんでした");
        return;
      }
    }
    setPrompts((items) => [created, ...items]); setSelectedId(created.id); setTab("edit"); setMobileDetail(true);
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), prompts }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `prompt-shelf-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); flash("バックアップを書き出しました");
  }
  async function importJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = "";
    try {
      if (file.size > PROMPT_LIMITS.maxImportBytes) throw new Error("file-too-large");
      const json: unknown = JSON.parse(await file.text());
      if (typeof json !== "object" || json === null || !("prompts" in json) || !Array.isArray(json.prompts)) throw new Error("invalid-format");
      if (json.prompts.length > PROMPT_LIMITS.maxPromptsPerUser) throw new Error("too-many-prompts");
      const imported = json.prompts.map((item) => normalizeImportedPrompt(item, userId ?? undefined));
      if (imported.some((item) => !item)) throw new Error("invalid-prompt");
      const safePrompts = imported.filter((item): item is PromptItem => Boolean(item));
      if (supabase && userId) {
        const { error } = await supabase.from("prompts").upsert(safePrompts.map((prompt) => toCloud(prompt, userId)));
        if (error) throw error;
      }
      await db.prompts.bulkPut(safePrompts);
      setPrompts(await db.prompts.toArray());
      flash(`${safePrompts.length}件を安全に読み込みました`);
    } catch {
      flash("JSONファイルを読み込めませんでした（2MB・500件まで）");
    }
  }

  if (isSupabaseConfigured && authState !== "authenticated") {
    return <AuthGate state={authState} error={authError} loginProvider={loginProvider} onLogin={beginLogin} />;
  }

  const provider = user?.app_metadata?.provider === "google" ? "google" : "github";
  const accountName = typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user?.user_metadata?.user_name === "string"
      ? user.user_metadata.user_name
      : user?.email ?? "ローカルユーザー";

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => { setView("all"); setFolder(null); setMobileDetail(false); }} aria-label="ホーム"><span className="brand-mark"><BookmarkSimple size={20} weight="fill" /></span><span>Prompt Shelf</span></button>
      <label className="search-box"><MagnifyingGlass size={20} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="プロンプトを検索" />{query && <button onClick={() => setQuery("")} aria-label="検索を消去"><X size={16} /></button>}</label>
      <div className={`sync-state ${syncState}`}><CloudCheck size={19} weight="fill" /><span>{syncLabels[syncState]}</span></div>
      <button className="icon-button" aria-label="通知"><Bell size={21} /></button>
      <div className="menu-anchor account-menu-anchor">
        <button className="avatar" aria-label="アカウントメニュー" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>{provider === "google" ? <GoogleLogo size={22} weight="bold" /> : <GithubLogo size={22} weight="fill" />}</button>
        {accountOpen && <div className="dropdown account-dropdown"><div className="account-summary"><strong>{accountName}</strong><span>{user?.email ?? "端末内だけで使用中"}</span></div>{userId && <button onClick={() => void signOut()}><SignOut size={17} />ログアウト</button>}</div>}
      </div>
    </header>

    <aside className="sidebar">
      <button className="new-button" onClick={() => void addPrompt()}><Plus size={20} />新規プロンプト</button>
      <nav className="primary-nav" aria-label="プロンプト分類">
        <NavButton active={view === "all" && !folder} icon={<FileText />} label="すべてのプロンプト" onClick={() => { setView("all"); setFolder(null); }} />
        <NavButton active={view === "favorites"} icon={<Star />} label="お気に入り" onClick={() => { setView("favorites"); setFolder(null); }} />
        <NavButton active={view === "recent"} icon={<Clock />} label="最近使った項目" onClick={() => { setView("recent"); setFolder(null); }} />
        <NavButton active={view === "trash"} icon={<Trash />} label="ごみ箱" onClick={() => { setView("trash"); setFolder(null); }} />
      </nav>
      <div className="folder-heading"><span>フォルダー</span><button aria-label="フォルダーを追加"><Plus size={17} /></button></div>
      <nav className="folder-nav">{folders.map((name) => <NavButton key={name} active={folder === name} icon={<Folder />} label={name} onClick={() => { setView("all"); setFolder(name); }} />)}</nav>
      <div className="sidebar-bottom"><button onClick={exportJson}><Archive size={20} />バックアップ</button><button><Gear size={20} />設定</button></div>
    </aside>

    <main className={`prompt-list-panel ${mobileDetail ? "mobile-hidden" : ""}`}>
      <div className="list-heading"><div><h1>{folder ?? (view === "favorites" ? "お気に入り" : view === "recent" ? "最近使った項目" : view === "trash" ? "ごみ箱" : "すべてのプロンプト")}</h1><p>{filtered.length}件</p></div>
        <div className="list-actions"><button><Funnel size={18} />フィルター<CaretDown size={14} /></button><div className="menu-anchor"><button onClick={() => setSortOpen(!sortOpen)}><SortAscending size={18} />並び替え<CaretDown size={14} /></button>{sortOpen && <div className="dropdown sort-menu"><button>更新が新しい順</button><button>名前順</button><button>使用回数順</button></div>}</div></div></div>
      <div className="prompt-cards">{filtered.map((prompt) => <button key={prompt.id} className={`prompt-card ${selected?.id === prompt.id ? "selected" : ""}`} onClick={() => { setSelectedId(prompt.id); setTab("use"); setMobileDetail(true); }}>
        <span className="card-top"><strong>{prompt.title}</strong><Star size={23} weight={prompt.isFavorite ? "fill" : "regular"} className={prompt.isFavorite ? "favorite" : ""} /></span><span className="description">{prompt.description}</span>
        <span className="card-bottom"><span className="tag-row">{prompt.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</span><small>最終更新 {relativeTime(prompt.updatedAt)}</small></span></button>)}
        {!filtered.length && <div className="empty"><MagnifyingGlass size={30} /><strong>該当するプロンプトがありません</strong><span>検索条件を変更してください。</span></div>}</div>
    </main>

    <section className={`detail-panel ${mobileDetail ? "mobile-visible" : ""}`}>{selected ? <>
      <div className="detail-header"><button className="mobile-back" onClick={() => setMobileDetail(false)}>‹ 一覧</button><div className="title-line"><h2>{selected.title}</h2><div className="detail-actions"><button onClick={() => updateSelected({ isFavorite: !selected.isFavorite })} aria-label="お気に入り"><Star size={26} weight={selected.isFavorite ? "fill" : "regular"} className={selected.isFavorite ? "favorite" : ""} /></button><div className="menu-anchor"><button onClick={() => setMenuOpen(!menuOpen)} aria-label="その他"><DotsThree size={27} weight="bold" /></button>{menuOpen && <div className="dropdown"><button onClick={exportJson}><Archive size={17} />JSONを書き出す</button>{userId && <button onClick={() => void signOut()}><SignOut size={17} />ログアウト</button>}<button className="danger" onClick={() => { updateSelected({ deletedAt: new Date().toISOString() }); setMenuOpen(false); }}><Trash size={17} />ごみ箱へ移動</button></div>}</div></div></div><div className="meta-row"><span className="tag-row">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</span><small>最終更新 {relativeTime(selected.updatedAt)}</small></div></div>
      <div className="tabs" role="tablist"><button className={tab === "use" ? "active" : ""} onClick={() => setTab("use")}>使う</button><button className={tab === "edit" ? "active" : ""} onClick={() => setTab("edit")}>編集</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>履歴</button></div>
      <div className="detail-scroll">
        {tab === "use" && <><section className="panel-card variable-card"><h3>変数を入力</h3><div className="fields">{selected.variables.map((variable, index) => <label key={variable.name}><span>{variable.label}</span>{variable.type === "textarea" ? <textarea maxLength={PROMPT_LIMITS.variableValue} value={variable.value} onChange={(e) => updateSelected({ variables: selected.variables.map((item, i) => i === index ? { ...item, value: e.target.value } : item) })} /> : variable.type === "select" ? <select value={variable.value} onChange={(e) => updateSelected({ variables: selected.variables.map((item, i) => i === index ? { ...item, value: e.target.value } : item) })}>{variable.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input maxLength={PROMPT_LIMITS.variableValue} value={variable.value} onChange={(e) => updateSelected({ variables: selected.variables.map((item, i) => i === index ? { ...item, value: e.target.value } : item) })} />}</label>)}</div></section>
          <section className="panel-card preview-card"><div className="section-title"><h3>完成したプロンプト</h3><button onClick={() => void copyText(completed, "完成文をコピーしました")} aria-label="コピー"><Copy size={19} /></button></div><pre>{completed}</pre></section></>}
        {tab === "edit" && <section className="panel-card edit-card"><h3>プロンプトを編集</h3><label><span>タイトル</span><input maxLength={PROMPT_LIMITS.title} value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} /></label><label><span>説明</span><textarea maxLength={PROMPT_LIMITS.description} value={selected.description} onChange={(e) => updateSelected({ description: e.target.value })} /></label><label><span>本文</span><textarea maxLength={PROMPT_LIMITS.body} className="body-editor" value={selected.body} onChange={(e) => updateSelected({ body: e.target.value })} /></label><p className="hint">変数は二重の波括弧で囲んで入力します。例：{`{{対象読者}}`}</p></section>}
        {tab === "history" && <section className="panel-card history-card"><h3>編集履歴</h3>{[0, 1, 2].slice(0, Math.min(selected.version, 3)).map((offset) => <div className="history-row" key={offset}><span className="history-dot" /><div><strong>バージョン {Math.max(1, selected.version - offset)}</strong><small>{offset === 0 ? "現在のバージョン" : `${offset}日前に保存`}</small></div><button disabled={offset === 0}>{offset === 0 ? "現在" : "復元"}</button></div>)}</section>}
      </div>
      <footer className="detail-footer"><span><CheckCircle size={18} weight="fill" />下書きを保存しました</span><div><button className="secondary" onClick={() => void copyText(selected.body, "原文をコピーしました")}>原文をコピー</button><button className="primary" onClick={() => void copyText(completed, "完成文をコピーしました")}><Copy size={19} />完成文をコピー</button></div></footer>
    </> : <div className="empty detail-empty"><FileText size={36} /><strong>プロンプトを選択してください</strong></div>}</section>

    <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importJson(event)} />
    <button className="mobile-backup" onClick={() => fileInput.current?.click()} aria-label="バックアップを読み込む"><Archive size={20} /></button>
    {toast && <div className="toast"><CheckCircle size={18} weight="fill" />{toast}</div>}
  </div>;
}

function AuthGate({ state, error, loginProvider, onLogin }: { state: AuthState; error: string; loginProvider: LoginProvider | null; onLogin: (provider: LoginProvider) => Promise<void> }) {
  return <main className="auth-shell">
    <section className="auth-card" aria-live="polite">
      <div className="auth-brand"><span className="brand-mark"><BookmarkSimple size={22} weight="fill" /></span><span>Prompt Shelf</span></div>
      {state === "checking" ? <div className="auth-checking"><SpinnerGap size={31} className="spinner" /><h1>安全なセッションを確認しています</h1><p>保存データは、本人確認が完了するまで読み込みません。</p></div> : <>
        <div className="auth-icon"><LockKey size={28} weight="fill" /></div>
        <h1>プロンプトを、あなただけの棚へ。</h1>
        <p className="auth-lead">GitHubまたはGoogleでログインすると、端末が変わっても自分のプロンプトだけを安全に利用できます。</p>
        <div className="auth-actions">
          <button className="oauth-button github" disabled={Boolean(loginProvider)} onClick={() => void onLogin("github")}><GithubLogo size={21} weight="fill" />{loginProvider === "github" ? "GitHubへ移動中…" : "GitHubで続ける"}</button>
          <button className="oauth-button google" disabled={Boolean(loginProvider)} onClick={() => void onLogin("google")}><GoogleLogo size={21} weight="bold" />{loginProvider === "google" ? "Googleへ移動中…" : "Googleで続ける"}</button>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="security-note"><ShieldCheck size={21} weight="fill" /><div><strong>ユーザーごとにデータを分離</strong><span>未ログイン時はデータを表示せず、ログアウト時はこの端末の一時キャッシュを消去します。</span></div></div>
        <p className="auth-footnote">OAuth認証を使用するため、GitHub・Googleのパスワードをこのアプリに入力する必要はありません。</p>
      </>}
    </section>
  </main>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}{label}</button>;
}
