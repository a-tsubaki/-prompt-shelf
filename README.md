# Prompt Shelf

生成AI向けプロンプトを保存・検索・再利用する、レスポンシブ対応のWebアプリです。Supabaseを設定するとGitHub／Googleログイン、ユーザーごとのデータ分離、複数端末同期が有効になります。

## ローカル起動

```bash
npm install
npm run dev
```

## クラウド同期の設定

1. Supabaseで新規プロジェクトを作成します。
2. SQL Editorで `supabase/schema.sql` を実行します。
3. GitHubでOAuth App、Google CloudでOAuthクライアントを作成し、SupabaseのAuthentication > Sign In / ProvidersでGitHubとGoogleを有効化します。
4. `.env.example` を `.env.local` にコピーし、Connect画面のProject URLとPublishable keyを設定します。GitHub Pages用の値は `.env.production` に設定済みです。
5. SupabaseのURL ConfigurationでSite URLとRedirect URLsにGitHub Pagesの公開URLを登録します。

GitHub OAuth AppのAuthorization callback URLには、SupabaseのGitHubプロバイダー画面に表示される次の形式のURLを設定します。

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Google OAuthクライアントの「承認済みのリダイレクトURI」にも同じSupabase callback URLを設定します。「承認済みのJavaScript生成元」は、GitHub Pagesのoriginのみを指定します。

```text
https://a-tsubaki.github.io
```

SupabaseのAuthentication > URL Configurationでは次を設定します。

```text
Site URL: https://a-tsubaki.github.io/-prompt-shelf/
Redirect URLs: https://a-tsubaki.github.io/-prompt-shelf/
```

OAuthのClient SecretはGitHubへコミットせず、Supabase Dashboard内だけに保存してください。

## セキュリティ

- 未ログイン時はプロンプト画面と端末キャッシュを読み込みません。
- ログアウト時にIndexedDBの一時キャッシュを消去します。
- `public.prompts` はRLSを有効化し、`auth.uid() = user_id` の所有者条件を全操作に適用します。
- `anon` ロールにはテーブル権限を与えません。
- 1ユーザー500件、本文10万文字、変数JSON 64KBなどの上限をデータベース側でも強制します。
- 公開フロントエンドにはPublishable keyだけを置き、Secret key／`service_role` keyは置きません。
- Content Security Policyで接続先をこのSupabaseプロジェクトに限定します。

## GitHub Pages

リポジトリのSettings > PagesでSourceを「GitHub Actions」に設定します。

`main`ブランチへpushすると自動公開されます。

公開URLは通常、次の形式です。

```text
https://a-tsubaki.github.io/-prompt-shelf/
```
