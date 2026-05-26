---
title: PWA修正 タスクリスト
date: 2026-05-27
---

## フェーズ1: PNGアイコン生成

- [x] `scripts/generate-icons.js` を作成（純粋なNode.js、外部依存なし）
- [x] `node scripts/generate-icons.js` を実行して3つのPNGを生成
  - `icons/icon-192.png`
  - `icons/icon-512.png`
  - `icons/apple-touch-icon.png`

## フェーズ2: manifest.json 更新

- [x] PNGアイコンエントリを追加（192, 512）
- [x] `"purpose": "any maskable"` を分離（`any` と `maskable` を別エントリに）

## フェーズ3: index.html 更新

- [x] `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">` を追加

## フェーズ4: deploy.yml 修正

- [x] `cp -r icons/ _site/` を追加

## フェーズ5: service-worker.js 更新

- [x] `CACHE_NAME` を `mazerun-v3` に更新
- [x] `PRECACHE_ASSETS` にアイコンファイルを追加

## 実装後の振り返り

- **実装完了日**: 2026-05-27
- **計画との差分**: ほぼ計画通り。`apple-mobile-web-app-title` メタタグも合わせて追加した（調査時に気づいた追加漏れ）
- **技術的なポイント**: PNGを外部ライブラリなしで生成するため、純粋なNode.js（zlib内蔵モジュール）でPNGエンコーダーを実装した。CRC32をソフトウェア実装し、IHDR/IDAT/IENDチャンクを手動構築
- **次回への改善提案**: キャッシュ戦略（stale-while-revalidate）と vite-plugin-pwa 移行で自動管理化すると保守性が上がる
