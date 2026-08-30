# MISSION ESCAPE PWA（GitHub Pages版）

企業展示ブースを巡るリアル謎解きゲームの、サーバー不要・完全静的PWAです。

## 構成

- `index.html` : アプリ入口
- `styles.css` : スマホ向けUI
- `app.js` : ゲーム進行、正誤判定、QR認証、端末保存
- `game-data.json` : A〜Dルートの問題・企業・QRトークン
- `manifest.webmanifest` : PWA設定
- `sw.js` : オフラインキャッシュ
- `icons/` : PWAアイコン
- `generate_qr.py` : 公開URLから各ブース用QRを生成
- `.nojekyll` : GitHub Pagesでそのまま静的配信するための空ファイル

## GitHub Pagesで公開

1. GitHubで新しいリポジトリを作成（例 `mission-escape-pwa`）。
2. このフォルダの中身をリポジトリのルートへアップロード。
3. `Settings` → `Pages`。
4. `Build and deployment` → `Source` を `Deploy from a branch`。
5. Branchを `main`、Folderを `/(root)` にして `Save`。
6. 公開URL例:
   `https://YOUR_GITHUB_NAME.github.io/mission-escape-pwa/`

すべて相対パスなので、GitHub Pagesの「リポジトリ名付きURL」で動作します。

## QRコード生成

公開URLが決まった後:

```bash
pip install -r requirements-qr.txt
python generate_qr.py https://YOUR_GITHUB_NAME.github.io/mission-escape-pwa/
```

`qr_output/` にブース別PNGと `qr_list.csv` が生成されます。

## ゲーム仕様

### Route A
企業名を導く謎 → 該当ブースへ移動 → QR認証 → 暗号片取得 → 次の謎。

### Route B/C/D
問題回答 → 正解で次の企業名表示 → 該当ブースへ移動 → QR認証 → 暗号片取得 → 次の問題。
最終問題は原稿上、正解後に企業名が指定されていないため、正解するとそのままFINAL CODEへ進みます。

## 重要：元原稿のブース数について

元原稿ではB/C/Dの冒頭に「10社・10枚」とありますが、本文で企業名が指定されているのは各ルート9社です。
10問目は正解後に「MISSION COMPLETE」となり、10社目の企業名が記載されていません。

この版では内容を勝手に補完せず、
- A: 13企業QR
- B: 9企業QR + 最終問題
- C: 9企業QR + 最終問題
- D: 9企業QR + 最終問題
として実装しています。

10社目が決まれば `game-data.json` の各ルート10問目に `booth` と `qrToken` を追加するだけで対応できます。

## サーバーレス版の制約

進行状況は `localStorage` に保存されます。したがって:

- 同じスマホ・同じブラウザならページを閉じても再開可能。
- 別端末には進捗を引き継げない。
- 管理者側で参加者数・到達数をリアルタイム集計できない。
- Webソースを詳しく調べる参加者には、正解やQRトークンを完全には隠せない。
- 景品交換の「一人一回」を厳密には保証できない。

学会イベントのカジュアルなスタンプラリー/脱出ゲームなら運用可能です。
厳密な不正防止・集計が必要になった場合だけ、後からCloudflare Workers/D1等を追加してください。

## 当日の推奨

PWAインストールは可能ですが、QRコードをスマホ標準カメラで連続して読むイベントでは、
**Chrome / Safariの同じブラウザで最後までプレイ**する運用が最も単純です。
