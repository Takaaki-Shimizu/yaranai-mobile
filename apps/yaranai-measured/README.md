# Yaranai 実測版 (apps/yaranai-measured)

スマホに渡していた時間を「実測」で取り戻す、Android向けのYaranai。
自己申告ではなく端末の利用統計(UsageStatsManager)を基準線と比較し、
取り戻した時間だけ庭が育つ。

## 五原則

1. **観測は無制限** — 全アプリの利用時間を受動的に記録する。選ばせない、煽らない、通知しない。
2. **挑戦中の誓いは3本** — 「やらない」と挑戦できるのは同時に3アプリまで。
   枠が空くのは**卒業(直近7日、一度も使っていない)したときだけ**で、
   負けているアプリを外す道は用意しない。卒業した誓いは枠から外れるが、
   計測と取り戻しのカウントは続く(ぶり返したら計測に戻せる)。
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
│    queryUsageEvents(beginMs, endMs)                      │
│    getAppLabels(packageNames) 端末に登録された正式なアプリ名 │
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
3. SQL Editor で `supabase/002_excuse_declarations.sql` を全文実行(言い訳カード)
4. SQL Editor で `supabase/003_graduation.sql` を全文実行(誓いの卒業)
5. SQL Editor で `supabase/004_terms_acceptances.sql` を全文実行(規約同意の記録)
6. Authentication → Providers で Email を有効にし、**Confirm email をONにする**
   (オンボーディングのメール確認待ち画面はこの前提)
7. Authentication → URL Configuration の Redirect URLs に
   `yaranaimeasured://confirm-email` と `yaranaimeasured://reset-password` を追加する
   (確認・再設定リンクからディープリンクでアプリへ戻すため)
8. Google認証(任意): Google Cloud でOAuthクライアントを作成し、
   Authentication → Providers → Google に Web クライアントのIDとシークレットを登録。
   同じ Web クライアントIDを `.env` の `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` に置く。
   未設定なら「Googleではじめる」ボタンごと出ない
9. `apps/yaranai-measured/.env` に接続情報を置く:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
# 開発者モード(任意)。ログイン中の email がこれと一致すると庭デバッグモードになる。
# 未設定なら常に本番挙動。個人メールはソースに直書きせずこの変数経由でのみ渡す。
EXPO_PUBLIC_DEV_EMAIL=
# Google認証のWebクライアントID(任意。未設定ならGoogleボタン非表示)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
# 規約URLが未公開の間、1にすると同意行ごと非表示(クローズドテスト用)
EXPO_PUBLIC_HIDE_TERMS_CONSENT=
```

> 注意: Google Sign-In はネイティブモジュール
> (`@react-native-google-signin/google-signin`)のため、**開発ビルドの作り直し
> (EASフルビルド)が必要。OTAでは配信できない。**旧ビルドではボタンごと
> 非表示になり、他の機能は変わらず動く。

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
- アプリ表示名は端末に登録された正式名(PackageManager)を最優先にする。
  「みてね」を Mitene、無名アプリを App54F7C05C と出さんため。引けんときだけ
  JS側の対応表 → パッケージ名の整形へ倒れる(lib/app-labels.ts)。
  正式名は端末のロケールに従うため、日本語端末では日本語名が出る。
  Android 11以降の可視性制限に対しては `<queries>`(ランチャーに出るアプリ)だけを
  宣言し、機微権限の QUERY_ALL_PACKAGES は使わない。
  誓いの行も表示時に正式名を優先するため、宣言済みの誓いも名前が直る
  (Supabaseの app_label は宣言時の記録として残す)。

## オンボーディングフロー — 2026-08

初回起動から庭までの道筋(v1)。二段階認証・サインアップの遅延・他OAuthはやらない。

```
スプラッシュ → [A]世界観導入(とばす可) → [B]サインアップ(規約同意統合)
  ├ メール登録 → [C]メール確認待ち(再送60秒クールダウン) → 確認リンク(ディープリンク)
  └ Google認証(ネイティブSign-In → signInWithIdToken)
→ [D]目立つ開示 → [E]使用状況アクセス許可(「あとで」の脇道あり)
→ [F]時間の行き先(observe?onboarding=1) → [G]宣言 → [H]完了画面
→ [I]理想を書く(とばす可) → 庭
   └ 履歴28日未満の端末は [F']待機モード → ホーム(28日到達の起動で[F]へ誘導)
```

[F]〜[I]の往復(宣言は1〜3本):

```
[F] 選べる数を先に断る(すくなくとも1つ・ここでは3つまで)
    ├ 0本 → 道しるべの一行だけ。先へ進む出口は無い(最低1本が要る)
    └ 1本以上 → 「すすむ」が現れる → [I]理想
[H] 完了画面の出口は枠の空き次第
    ├ 枠が残る → [F]へ返す(「つづけて選ぶ」)。理想へは流さない
    └ 3本埋まった → [I]理想へ(「すすむ」)
```

```
lib/onboarding.ts    進行の印(AsyncStorage)。導出できるステップは導出を優先し、
                     印は worldview_seen / pending_email / disclosure_seen /
                     permission_deferred / done.<uid> / waiting.<uid> だけ
lib/terms.ts         規約URL・バージョン定数、同意のローカル記録とSupabase再送
lib/google-auth.ts   ネイティブGoogle Sign-Inのラッパー(不在なら利用不可へ倒す)
app/(auth)/worldview.tsx      [A] 世界観導入
app/(auth)/confirm-email.tsx  [C] メール確認待ち(未確認の再起動はここへ再開)
app/(app)/disclosure.tsx      [D] 目立つ開示(Play要件)
app/(app)/waiting.tsx         [F'] 待機モード
supabase/004_terms_acceptances.sql  同意の記録(RLSは自分の行のみ)
```

- 振り分けの正はホーム(`app/(app)/index.tsx` の「門」)。権限なし→開示/許可、
  未完(宣言0本)→時間の行き先、履歴28日未満→待機、それ以外→ふだんのホーム。
  宣言が既にあるユーザーは自動で完了扱い(既存ユーザーに新規画面は出ない)
- 許可を「あとで」にした人のホームは観測なしの静かな案内だけ
  (庭なし・開示への再訪リンク)。強制・警告色は使わない
- 同意はサインアップ開始時にローカル記録し、セッションが張られた起動で
  Supabaseへ送る(`app/(app)/_layout.tsx`)。オフラインでも失わない

## 庭(絵巻)アーキテクチャ — 2026-07 刷新

庭は5段階の切り替え絵をやめ、**データから毎回描画されるパラメトリックな一枚**になった。
デザインの正は `docs/mocks/`(yaranai-north-star-v3.html / yaranai-garden-growth.html)。
論理キャンバスはモックの1200×800を中央パネルに、横3300(約2.75画面)の絵巻へ拡張している。

```
lib/garden/            純関数(node:test でテスト)
  growth.ts            データ→成長パラメータ。単調非減少ガード(高水位マージ)
  gate.ts              週次開扉(土曜・日曜の暦日のみ。祝日は対象外)。閉扉文言もここ
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

## 言い訳カード — 2026-07

庭が守るのは内発的な渇望(自分がつい開く)。言い訳カードが守るのは外圧(周囲からの誘い)。
主動線はリアクティブな断りではなく、**掲げておく常設の宣言**である ── カードを静かに掲げ、
見た人が「この人はやらないと宣言している」と知り、そもそも誘われる場面が減る。
悪者になるのはYaranaiであって本人ではない。

非交渉の制約(製品として動かさない線):

- **1人1枚。** 現行の宣言は `superseded_at is null` の1件だけ。差し替えは自由(回数制限なし)だが、
  旧行は削除せず superseded 化して残す(単調非減少)。差し替えは作成と同じ儀式を必ず通る。
- **実データを載せない。** Day数・取り戻し時間・庭の状態は出さない。カード上の唯一の事実情報は宣言日。
- **カード宣言は庭に一切影響しない。** 苔・敷石・光・週数のどのパラメータにも接続しない。
- **朱を使わない。** カードのアクセントは灯り(暖色の光)が担う。
- **正本はSupabase。** アンインストールで消えてはならない(端末側はキャッシュ)。
- カウントダウン・FOMO・共有の煽り・バッジ・催促通知を足さない。

構成:

```
lib/excuse/
  validate.ts    宣言文の規則(人は「やらないこと」を全角20字まで(理想と同じ)。
                 「はやらない。」と1〜2行の行組みはアプリが添える)。純関数・テスト対象
  card-spec.ts   版下(モックv3の座標・色)。描画系に依存しない純データ
  qr.ts          QRのモジュール行列(qrcode-generator, 誤り訂正Q)
  url.ts         QRの遷移先 https://yaranai.app/?utm_source=excuse_card
  format.ts      宣言日の表記「2026年7月29日 宣言」
  storage.ts     正本(Supabase)とキャッシュ(AsyncStorage)
  timeline.ts    完成演出(2000ms・2段)
  preview-svg.ts 版下→SVG の照合器(開発用)
components/excuse/
  bake.ts        版下→Skia。3層(地/灯り/文字)に焼き、書き出しは1枚に畳む
  ExcuseCardView.tsx  9:16の表示と完成演出
  share.ts       PNG書き出し → Android標準の共有シート
  ShareGlyph.tsx 共有アイコン(共有導線の印)
components/AppFooter.tsx  固定フッター3タブ(庭/読みもの/言い訳カード)
```

版下のプレビュー(実機に入れる前の照合):

```bash
npx tsc -p tsconfig.test.json
node scripts/render-excuse-cards.js /tmp/excuse-cards
# 出力されたSVGをブラウザで開いて docs/mocks の言い訳カード モックv3 と見比べる
# mock/longest/single の3ケース × 2サイズ
```

## 誓いの卒業 — 2026-08

誓いを断ち切れた人が、次のアプリに挑戦できるようにする仕組み。「入れ替え」ではなく
「卒業」── **成功によってのみ枠が空く一方通行**で、負けているアプリを外す逃げ道は
構造的に作らない。ただし卒業後にぶり返したら「計測に戻す」ことができる。

非交渉の制約(製品として動かさない線):

- **卒業は成功でしか起きない。** 条件は「前日までの7暦日、一度も使っていない」だけ。
  窓に当日は含めない(含めると実質6日と数時間の判定になり、日中の使用で成立が
  揺れる)。成立は日付が変わった時点で定まる。挑戦中(使用が残っている)の誓いを
  外す手段はアプリのどこにも無い。
- **「使った」の粒度は、画面に出る数字と同じ分粒度。** その日の前景時間を分へ
  四捨五入して1分以上なら使った、0分なら使っていない(`lib/graduation.ts` の
  `isUsedDay`。閾値は30秒)。ms厳密(`> 0`)にしてはならない ── この機能が見せる
  数字はどこも分に丸めとる(「昨日の使用 0分」「+54分」「1日平均◯分」)けん、
  判定だけをmsで持つと、リンクのタップ・PiP・キャストで数秒だけ前面に出た日が
  「0分」の顔をしたまま卒業を恒久的に塞ぐ。利用者には7日連続0分に見えとるのに
  導線が現れん、という**アプリが自分の見せた数字を裏切る**状態になる。
  丸めの式は `usage-db.ts` の `getMinutesForPackage` と一致させる。
- **卒業しても計測と取り戻しのカウントは続く。** 卒業 = 挑戦の3枠から外れるだけで、
  誓いそのものは生き続ける(消えない蓄積)。`syncMeasuredDaily` の対象フィルタに
  `graduated_on is null` を足してはならない。
- **基準線は永久に固定。** 卒業でも復帰でも再計算しない(五原則3)。
- **通知・プッシュ・煽りは一切なし**(五原則1)。卒業可能になっても静かに導線が
  現れるだけ。復帰も、ぶり返したアプリが時間の行き先に再浮上したときだけ。
- **「時間の行き先」に挑戦中の誓いを出すかどうかは、卒業判定そのもので決める。**
  候補窓(当日を含む7日)ではなく、卒業判定の窓(前日までの7日)を同じ述語で見て、
  **成立したら一覧から落とす**。これで「一覧から消えた ⟺ 卒業できる」が両向きとも
  構造的に成立する。以前は足切りの免除で対応を保証しとったが、窓が1日ずれる以上
  免除では担保できんかった ── 当日だけ使ったアプリは「一覧に残る**かつ**卒業できる」、
  7日前だけ使ったアプリは「一覧から消えとる**のに**卒業できん」になっとった。
  判定の材料集めは `lib/graduation-check.ts` に一本化し、ホーム・observe・graduate が
  同じ窓・同じクエリを通る(3箇所で書くと、片方だけずれても誰も気づけん)。
- **誓いのなか・卒業済みのアプリはノイズ足切りを免除。** 候補一覧の足切り
  (週合計5分未満・12週平均0.5分未満・上限30件)は誓いの無いアプリだけに掛ける。
  卒業済みのアプリが再浮上する条件は「直近7日の合計が1分以上」── ここも粒度は
  表示に合わせる(数秒の前面化で「計測に戻す」を突きつけない)。
- **オンボーディング(`observe?onboarding=1`)では足切りを一切掛けない。** 免除の
  対象は誓いのあるアプリやけん、誓いが1本もない登録直後は誰も免除されず、使い
  始めて日が浅いアプリ(12週平均が希釈されて小さい)が丸ごと消える。最初の一枚で
  「最近使っとるのに一覧に出てこない」が起きんよう、上限30件だけを残す。
- **庭・苔・敷石・光のロジックには触れない。** 単調非減少に影響する変更は不可。

誓いの3状態(`measured_vows`):

| 状態 | 条件 | 3本に数える | 同期・カウント |
|---|---|---|---|
| active(挑戦中) | `discontinued_on` null / `graduated_on` null | 数える | する |
| graduated(卒業) | `discontinued_on` null / `graduated_on` あり | 数えない | **する** |
| discontinued(廃止) | `discontinued_on` あり | 数えない | しない |

枠の担保は DB トリガー `check_measured_vow_limit()` が唯一の正
(active になる行だけを制限対象にする)。復帰は `graduated_on` を NULL へ戻す
UPDATE なので、3本挑戦中ならトリガーが弾く。クライアント側の事前チェックは補助。
卒業済みパッケージへの新規宣言は既存の unique index `measured_vows_active_pkg`
(`where discontinued_on is null`)が弾く ── 卒業したアプリにできるのは復帰だけ。

```
lib/graduation.ts        卒業判定の純関数と「使った」の粒度(node:test でテスト)
lib/graduation-check.ts  窓の取り方と端末内DBの読み出し。判定の入口はここだけ
lib/dates.ts             判定窓(graduationWindowDates)と候補窓(recentWindowDates)
app/(app)/(tabs)/index.tsx  卒業の導線(成立した誓いの行にだけ1行)
app/(app)/observe.tsx    時間の行き先。挑戦中の誓いは卒業判定で残す/落とすを決める
app/(app)/graduate.tsx  卒業の儀式(確認 → 完了画面)。実行前に条件を再評価する
app/(app)/declare.tsx   卒業済みパッケージでは復帰モードで描画(基準線は再計算しない)
supabase/003_graduation.sql  graduated_on + トリガー差し替え + ビュー作り直し
```

003 が未適用の Supabase(`graduated_on` 列なし)に対しても、クライアントは
旧スキーマとして動く: `graduated_on` の参照が 42703 で落ちたら列なしで引き直し、
全行を挑戦中として扱う(`lib/vows.ts` の `isMissingGraduatedOn`)。畳まれるのは
卒業の導線だけで、**計測中の誓いの表示は消えない**。スキーマ不一致や通信断で
誓い一覧が引けんかった回は、空配列で上書きせず前回の表示を残す(ホーム・observe)。
卒業機能そのものを使うには 003 の適用が必要。

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
- 庭モード(絵巻)は週末に限らず365日、庭のタップで開ける。スライダー値を
  ルートパラメータ(`days`/`hours`)で渡し、絵巻も同じ庭を描く(高水位・実測には触れない)。
- 本番ユーザーからは到達不可能(email 不一致なら UI 自体が現れない)。
