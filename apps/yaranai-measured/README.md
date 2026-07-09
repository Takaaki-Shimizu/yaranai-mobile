# Yaranai 実測版 (apps/yaranai-measured)

スマホに渡していた時間を「実測」で取り戻す、Android向けのYaranai。
自己申告ではなく端末の利用統計(UsageStatsManager)を基準線と比較し、
取り戻した時間だけ庭が育つ。

## 五原則

1. **観測は無制限** — 全アプリの利用時間を受動的に記録する。選ばせない、煽らない、通知しない。
2. **誓いは3本** — 「やらない」と宣言できるのは同時に3アプリまで。
3. **基準線は宣言時スナップショットで固定** — 過去12週(84日)の1日平均。以後変更しない。
4. **ローカルファースト** — 全アプリの利用ログは端末内DBのみ。Supabaseに出るのは誓い対象アプリの日次合計と基準線だけ。
5. **ロックなし** — ブロック・強制・ペナルティなし。基準線を超えた日は獲得0になるだけで、庭は縮まない。

## 重要: Expo Goでは動きません

このアプリはネイティブモジュール(`modules/usage-stats`)を含むため、
**expo-dev-client を組み込んだ開発ビルド(またはEASビルド)が必要**です。
Expo Goで開くとネイティブモジュールが見つからず、常に「利用不可」へフォールバックします。

```bash
# 開発ビルド(Androidの実機/エミュレータ + Android SDK が必要)
npx expo run:android

# 以後の開発
npx expo start --dev-client
```

## アーキテクチャ概要

```
┌─ Android OS ────────────────────────────────────────────┐
│  UsageStatsManager (日次7日 / 週次4週 / 月次6ヶ月 保持)   │
└──────────────┬──────────────────────────────────────────┘
               │ queryUsageStats(生バケット。範囲に重なる分は丸ごと返る)
┌──────────────▼──────────────────────────────────────────┐
│  modules/usage-stats (Expo Modules API / Kotlin)         │
│    hasUsageAccess() / openUsageAccessSettings()          │
│    queryUsageBuckets(interval, beginMs, endMs)           │
└──────────────┬──────────────────────────────────────────┘
               │ JSラッパー(非Androidでは利用不可へフォールバック)
┌──────────────▼──────────────────────────────────────────┐
│  観測レイヤー (端末内・外に出ない)                        │
│    lib/usage-buckets.ts 範囲判定と集計(純粋関数・テスト対象)│
│    lib/usage-sync.ts  起動時に直近7日の日次バケットを同期  │
│    lib/usage-db.ts    expo-sqlite: usage_daily(日×アプリ) │
│    lib/baseline.ts    宣言時: 12週平均のスナップショット   │
└───────┬──────────────────────────────┬──────────────────┘
        │ 全アプリの利用ログ            │ 誓い対象アプリの
        │ (端末内DBのみ)               │ 日次合計と基準線だけ
┌───────▼───────┐              ┌───────▼──────────────────┐
│  画面4つ       │              │  Supabase (申告版とは別)  │
│  許可/観測/    │              │   measured_vows (3本制限) │
│  宣言/庭       │              │   measured_daily          │
│  (庭とテーマは │              │   measured_saved /        │
│   @yaranai/core)│             │   garden_state ビュー     │
└───────────────┘              └──────────────────────────┘
```

計算規則:

- 「時間の行き先」は直近7日に使用のあるアプリ(今も続いとる習慣)を、
  12週平均(基準線と同じ計算)の大きい順に表示する。数字は宣言時に
  固定される基準線と必ず一致する。履歴が28日未満の間は「集めています」表示
- その日の取り戻し時間 = `max(0, 基準線(分) − 実測(分))`
- 庭のphase = 累計取り戻し時間(時間) ÷ 210、下限0.05、上限1.0(`MOSS_FULL_HOURS` と一致)
- 実測が取得できなかった日(端末未起動・履歴切れ等)は行を作らない = 獲得0

## セットアップ(人間の残作業)

### 1. Supabaseプロジェクト(申告版とは別に作る)

1. supabase.com で新規プロジェクトを作成
2. SQL Editor で `supabase/001_schema.sql` を全文実行
3. Authentication → Providers で Email を有効にする
4. `apps/yaranai-measured/.env` に接続情報を置く:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
# 開発者モード(任意)。ログイン中の email がこれと一致すると庭デバッグモードになる。
# 未設定なら常に本番挙動。個人メールはソースに直書きせずこの変数経由でのみ渡す。
EXPO_PUBLIC_DEV_EMAIL=
```

> 注意: `.env` に個人メールを入れる。`.env` が git 追跡から外れている(=`.gitignore` 済み)ことを
> 必ず確認してからコミットすること。キー名の存在は値なしで `.env.example` に控えてある。

### 2. EAS(ビルドは人間が実行する)

1. expo.dev のアカウントを用意し、`npm i -g eas-cli` → `eas login`
2. `apps/yaranai-measured` で `eas init` を実行し、発行された projectId が
   `app.json` に追記されることを確認する
3. 環境変数をEASに登録する(`eas env:create` または expo.dev のダッシュボード)。
   `EXPO_PUBLIC_DEV_EMAIL` も忘れず登録する(登録漏れだと preview/development
   ビルドで開発者モードが効かない)。
4. 内部配布用APK: `eas build --profile preview --platform android`
5. 開発クライアント: `eas build --profile development --platform android`

### 3. Google Play(将来のストア公開時)

- 使用状況アクセス(`PACKAGE_USAGE_STATS`)は機微権限。公開時には
  Play Console の権限宣言フォームの提出と審査、プライバシーポリシーの掲示、
  目立つ開示と同意が必要になる。取得データはストア掲載機能の実装に
  必要な範囲に限定し、未開示目的で利用しない。

## 既知の割り切り(v1)

- **日付境界は暦日(0時)** — OSの日次集計バケットが暦日基準のため。
  申告版の朝4時境界の再現は、UsageEventsから前景時間を自前で積み上げる将来課題。
- `queryUsageStats` は範囲に重なるバケットを丸ごと返す(公式Docの既知挙動)ため、
  firstTimeStamp が窓内のバケットだけを合算する(lib/usage-buckets.ts)。
  基準線は日次→週次→月次の順に重複なしで継ぎ足し、実際に集計できた日数で割る。
  バケット境界の都合で84日がフルに埋まらんことがあり、その場合は分母も短くなる。
- 12週遡及の後半は週次・月次の粗い集計を含む平均になる(OSの保持期間の制約)。
- 利用統計は端末に紐づくため、機種変更でリセットされる。
  履歴が28日未満の間は宣言できず「基準線を集めています」の待機になる。
- Android限定。iOSはAPI制約(サンドボックス)により実測不可のため対象外。
- 当日の実測は未確定のためSupabaseへ送らない(翌日以降の起動時に確定日として同期)。
- アプリ表示名はJS側の対応表とパッケージ名の整形で決める
  (ネイティブの公開APIを3つに保つため。PackageManagerには問い合わせない)。

## 庭(絵巻)アーキテクチャ — 2026-07 刷新

庭は5段階の切り替え絵をやめ、**データから毎回描画されるパラメトリックな一枚**になった。
デザインの正は `docs/mocks/`(yaranai-north-star-v3.html / yaranai-garden-growth.html)。
論理キャンバスはモックの1200×800を中央パネルに、横3300(約2.75画面)の絵巻へ拡張している。

```
lib/garden/            純関数(node:test でテスト)
  growth.ts            データ→成長パラメータ。単調非減少ガード(高水位マージ)
  gate.ts              週次開扉(日曜の暦日のみ)。閉扉文言もここ
  scene.ts             成長パラメータ→絵巻の描画スペック。モックの座標・色を移植
  scene-types.ts       レンダラ非依存のプリミティブ型
  prng.ts              シード付き乱数(同じデータなら同じ庭)
  preview-svg.ts       開発用: スペック→SVG(モック照合)
components/garden/     React Native + Skia(アプリのみ)
  renderer.ts          スペック→Skia。起動時にレイヤーをSkImageへベイク
  HomeGarden.tsx       ホームの窓(静止画、画面高60%)
  GardenScroll.tsx     庭モード(横パン+視差+ラバーバンド+エッジピーク)
app/(app)/garden.tsx   庭モードの画面(週次開扉ガード、フェード遷移)
scripts/render-garden-previews.js  Day1/42/84のSVGプレビュー出力
```

データ対応(§4): 石=宣言(最大3・育たない) / 敷石・杭縄=記録日数 n /
苔=累計取り戻し時間(210h=満開、`MOSS_FULL_HOURS` と同一) / 竹・靄・光・影=継続週数 w=floor(n/7) /
朱のひとひら=w=12。崩れた日は「増えない」だけで、どの要素も後退しない。

性能: 揺らぎ(DisplacementMap+FractalNoise)とぼかしはベイク時に一度だけ評価し、
パン中は各レイヤーのSkImageを平行移動するだけ。ベイク解像度の上限
(`MAX_BAKE_SCALE`)とホーム庭の高さ(60%)は実機で調整する。

プレビューの出し方:

```bash
npx tsc -p tsconfig.test.json
node scripts/render-garden-previews.js /tmp/garden-previews
# 出力されたSVGをブラウザで開いて docs/mocks/reference/ と見比べる
```

## 開発者モード(庭デバッグ)

実機で庭の見た目を素早く検証するための開発者専用モード。日数と累計取り戻し時間を
スライダー/数値で手動注入し、庭をリアルタイムに再描画する。**本番ユーザーの挙動は一切
変えない。**

- 判定: `EXPO_PUBLIC_DEV_EMAIL` とログイン中セッションの email が一致したら開発者
  (`lib/developer.ts`)。未設定なら常に本番挙動。個人メールはソースに直書きしない。
- 開発者モードでは Android の利用統計(`UsageStatsManager`)を一切取得しない。
  起動時同期(`syncAll`)も使用状況アクセスの許可要求もスキップする(§5)。
- 庭のデータソースはスライダー入力だけ。`buildGrowthFromDebug` が
  `GardenSnapshot`(石=固定3)を組んで `deriveGrowth` に直接渡す。高水位マージ
  (`mergeHighWater`)も high-water の読み書きも通さない(§3)。
- 差分演出(`changedCategories`/`changeNote`/`diffStages`)も
  `garden_last_seen_state` も触らない。常に現在のスライダー値に対応する一枚だけを描く(§4)。
- 苔スライダーの上限は `MOSS_FULL_HOURS`(=210時間で満開)を import して使う。
- 本番ユーザーからは到達不可能(email 不一致なら UI 自体が現れない)。
