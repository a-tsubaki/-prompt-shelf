import type { PromptItem } from "./types";

const now = new Date().toISOString();

export const starterPrompts: PromptItem[] = [
  {
    id: "story-structure",
    title: "物語構造の編集チェック",
    description: "物語の構造・整合性・キャラクターの魅力を多角的にチェックし、改善点を提案します。",
    body: "あなたは経験豊富な物語編集者です。\n以下の条件で提示する物語について、構造・整合性・キャラクターの魅力・テーマ性の観点から詳しく分析し、改善点を具体的に提案してください。\n\n【作品ジャンル】\n{{作品ジャンル}}\n\n【対象読者】\n{{対象読者}}\n\n【作品設定・プロット】\n{{作品設定・プロット}}",
    folder: "物語・キャラクター", tags: ["物語", "編集", "汎用"], aiTargets: ["汎用"], isFavorite: true,
    variables: [
      { name: "作品ジャンル", label: "作品ジャンル", type: "select", value: "現代ファンタジー", options: ["現代ファンタジー", "SF", "ミステリー", "ダークファンタジー"] },
      { name: "対象読者", label: "対象読者", type: "select", value: "青年漫画読者", options: ["青年漫画読者", "少年漫画読者", "一般文芸読者", "ライトノベル読者"] },
      { name: "作品設定・プロット", label: "作品設定・プロット", type: "textarea", value: "ごく普通の高校生が、ある日、異世界とつながる扉を見つける。最初は戸惑うが、現実世界と異世界を行き来する中で、次第に自分の使命に気づいていく。仲間との出会いや、強大な敵との対立を通じて成長していく物語です。" },
    ],
    useCount: 12, version: 3, createdAt: now, updatedAt: now,
  },
  {
    id: "image-prompt", title: "画像生成プロンプト設計", description: "高品質な画像を生成するための詳細なプロンプトを設計するテンプレートです。",
    body: "{{主題}}を中心に、{{画風}}で画像生成用プロンプトを作成してください。", folder: "画像生成", tags: ["画像生成", "デザイン", "汎用"], aiTargets: ["画像生成AI"], isFavorite: false,
    variables: [{ name: "主題", label: "主題", type: "textarea", value: "雨の東京を歩く孤独なヒーロー" }, { name: "画風", label: "画風", type: "text", value: "シネマティックな現代アニメ" }],
    useCount: 8, version: 1, createdAt: now, updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "web-proposal", title: "Webサイト制作提案", description: "要件に基づいて、効果的なWebサイトの構成・デザイン・実装方法を提案します。",
    body: "{{サービス概要}}をもとに、Webサイト制作提案書の構成を作成してください。", folder: "企画・分析", tags: ["企画", "Web制作", "ビジネス"], aiTargets: ["汎用"], isFavorite: false,
    variables: [{ name: "サービス概要", label: "サービス概要", type: "textarea", value: "" }], useCount: 4, version: 1, createdAt: now, updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "character-depth", title: "キャラクター設定の深掘り", description: "キャラクターの背景・性格・行動原理を深掘りし、魅力的な人物像を作るためのプロンプトです。",
    body: "{{キャラクター概要}}から、矛盾を解消しつつ魅力的な人物設定を作成してください。", folder: "物語・キャラクター", tags: ["キャラクター", "物語", "創作"], aiTargets: ["汎用"], isFavorite: false,
    variables: [{ name: "キャラクター概要", label: "キャラクター概要", type: "textarea", value: "" }], useCount: 6, version: 2, createdAt: now, updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "idea-review", title: "企画アイデアの評価", description: "新しい企画アイデアを多角的に評価し、改善点や実現可能性を分析するプロンプトです。",
    body: "{{企画案}}を独創性、需要、実現可能性の3点から評価してください。", folder: "企画・分析", tags: ["企画", "分析", "ビジネス"], aiTargets: ["汎用"], isFavorite: false,
    variables: [{ name: "企画案", label: "企画案", type: "textarea", value: "" }], useCount: 2, version: 1, createdAt: now, updatedAt: new Date(Date.now() - 259200000).toISOString(),
  },
];
