# Prompt Shelf

生成AI向けプロンプトを保存・検索・再利用する、レスポンシブ対応の個人用Webアプリです。IndexedDBでローカル保存し、Supabaseを設定するとGitHubログインと複数端末同期が有効になります。

## ローカル起動

```bash
npm install
npm run dev
```

## クラウド同期の設定

1. Supabaseで新規プロジェクトを作成します。
2. SQL Editorで `supabase/schema.sql` を実行します。
3. GitHubでOAuth Appを作成し、SupabaseのAuthentication > Sign In / ProvidersでGitHubを有効化します。
4. `.env.example` を `.env.local` にコピーし、Connect画面のProject URLとPublishable keyを設定します。GitHub Pages用の値は `.env.production` に設定済みです。
5. SupabaseのURL ConfigurationでSite URLとRedirect URLsにGitHub Pagesの公開URLを登録します。

GitHub OAuth AppのAuthorization callback URLには、SupabaseのGitHubプロバイダー画面に表示される次の形式のURLを設定します。

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

## GitHub Pages

リポジトリのSettings > PagesでSourceを「GitHub Actions」に設定します。

`main`ブランチへpushすると自動公開されます。

公開URLは通常、次の形式です。

```text
https://a-tsubaki.github.io/-prompt-shelf/
```
