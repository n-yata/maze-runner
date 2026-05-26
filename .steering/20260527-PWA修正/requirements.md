---
title: PWA修正（最小修正アプローチ）
date: 2026-05-27
---

## 背景

PWA対応がうまくいっていない。調査の結果、以下の問題が判明。

## 修正対象の問題（最小修正）

### Critical
- `deploy.yml` に `cp -r icons/ _site/` が抜けており、本番にアイコンがデプロイされない

### High
- PNGアイコン（192x192, 512x512）が存在せず、Chromeのインストール要件を満たさない
- iOS向け `apple-touch-icon`（180x180 PNG）が欠落

## スコープ外（今回は対応しない）

- キャッシュ戦略の改善（stale-while-revalidate等）
- Vite + vite-plugin-pwa への移行
- Service Worker の更新通知UI
