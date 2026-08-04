# 復元フロー 事前調査報告書(実測版)

対象: `apps/yaranai-measured` のみ / 調査日: 2026-08-04 / HEAD: `b37443d`
調査種別: **read-only**。コード変更・マイグレーション新規作成は行っていない。

---

## 冒頭サマリ — 移行作業が必要な項目

最優先の2項目(Q1 シード / Q2 基準線)は、**いずれも移行不要**だった。
懸念されていた「復元後に別の庭が生える」「基準線が戻らない」は、どちらも起きない。

一方、調査の過程で**別の場所に移行が必要な穴**が見つかった。

| 優先 | 項目 | 何が起きるか | 必要な作業 |
|---|---|---|---|
| **高** | **理想(掛け軸テキスト)** | 端末 AsyncStorage にしか無い。復元後、庭の直上の掛け軸が空に戻る | Supabase への昇格(新規カラム/テーブル)。**このタスクでは作成していない** |
| **高** | **日次実測の欠落** | 6日以上アプリを開かないと、その間の `measured_daily` 行が端末にもサーバーにも生まれず**恒久欠落**する。復元とは独立した既存の穴 | 復元フロー実装前に挙動を確定させる。復元では埋められない |
| 中 | 庭の高水位マーク | 端末のみ。失われると、サーバー側に欠落日がある場合に庭が後退して見える | 復元完了時に `loadGrowth` の結果で初期化(コード追加のみ、マイグレーション不要) |
| 低 | 前回表示状態(差分演出) | 端末のみ。失われると復元後の初回表示で全要素が一斉にフェードインする | 復元完了時に `saveLastSeen`(コード追加のみ) |
| 低 | 読みもの既読状態 | 端末のみ・user_id 非分離。復元後、全記事が未発火に戻る | 昇格するか再読を許容するかは設計判断(§6 相当) |

**移行不要と確定**: 誓い・基準線・窓日数・宣言日・卒業日・廃止日・日次実測・言い訳カード宣言・共有ログ・規約同意・庭の成長パラメータ・誓い別ログ写し・端末利用ログ・オンボーディングの印。

---

## 1. 最優先の2項目

### Q1. 庭のPRNGシードの生成元と保存先

#### Q1-1. シード値は何から作られているか

**結論**: すべて**ソースコード上の定数リテラル**。端末乱数(`Math.random()`)も `user_id` 等の外部値も、シードには一切使われていない。

**根拠**:

```
lib/garden/scene.ts:42    const WING_SEED = 0x59a7;
lib/garden/scene.ts:241   const COBBLE_JITTER_SEED = 0x0c0b1e;
lib/garden/scene.ts:242   const COBBLE_SHAPE_SEED = 0x51a7c3;
lib/garden/scene.ts:249     const rng = mulberry32(COBBLE_JITTER_SEED);
lib/garden/scene.ts:283     const rng = mulberry32(COBBLE_SHAPE_SEED);
lib/garden/scene.ts:568     const rng = mulberry32(WING_SEED);
```

```
lib/garden/bamboo.ts:109    const r = mulberry32(51);    // 翼の竹の稈
lib/garden/bamboo.ts:199    const rC = mulberry32(31);   // 借景の竹林
lib/garden/bamboo.ts:211    const rL = mulberry32(7);    // 舞い葉
```

```
lib/launch/komichi.ts:12    export const KOMICHI_SEED = 84210;
lib/launch/komichi.ts:218     const rnd = mulberry32(KOMICHI_SEED);
```

揺らぎ(fractal noise)のシードも定数:

```
lib/garden/tokens.ts:118-120
  strong: { baseFrequency: 0.012, octaves: 3, seed: 7,  scale: 16 },
  soft:   { baseFrequency: 0.02,  octaves: 2, seed: 11, scale: 8  },
  cobble: { baseFrequency: 0.05,  octaves: 2, seed: 4,  scale: 6  },
```

`Math.random()` はリポジトリ全体で 2 箇所のみ、いずれも**庭とは無関係**:

```
app/(app)/excuse/new.tsx:41   const seed = useRef(Math.random()).current;
lib/excuse/placeholders.ts:44 export function pickPlaceholder(lang: Lang, random: number = Math.random()): string
```

これは言い訳カード入力欄の**プレースホルダ文言の抽選**であり、庭の描画には触れない。

**確度**: 確定。

#### Q1-2. 生成されたシードは永続化されているか

**結論**: 永続化は**存在しない。必要もない**(シードが定数なので、永続化する対象が無い)。

**根拠**: `mulberry32` の呼び出し元 6 箇所(上記)はすべてモジュールトップレベルまたは関数内の即時生成で、
AsyncStorage / SecureStore / SQLite / Supabase のいずれにもシード値を書き出すコードは存在しない。
AsyncStorage の全キーは Q6 に列挙したが、シードに相当するものは 1 つも無い。

**確度**: 確定。

#### Q1-3. 別端末で新規インストールしたとき、同じ庭が描画されるか

**結論**: **Yes**(同一ユーザー・同一データなら同じ庭になる)。

**理由**: 庭の描画スペックを組む `buildScene` は `GrowthParams` **1つだけ**を引数に取り、シードを受け取らない。

```
lib/garden/scene.ts:821   export function buildScene(g: GrowthParams): Scene {
```

そして `GrowthParams` は `GardenSnapshot`(石数・記録日数・累計取り戻し分)からの純関数出力で、
そのスナップショットは Supabase の `measured_saved` / `measured_daily` から作られる:

```
components/garden/load.ts:55-64
  const [savedRes, daysRes] = await Promise.all([
    supabase.from('measured_saved').select('saved_minutes'),
    supabase.from('measured_daily').select('record_date'),
  ]);
  ...
  stoneCount:   vows.length,
  savedMinutes: vows.reduce((sum, v) => sum + Number(v.saved_minutes ?? 0), 0),
  recordedDays: new Set((daysRes.data ?? []).map((d) => d.record_date as string)).size,
```

つまり **同じ Supabase データ → 同じ `GrowthParams` → 同じ `Scene`** が成立する。
コード側のコメントもこれを設計意図として明記している:

```
lib/garden/prng.ts:1   // シード付き乱数(mulberry32)。同じデータなら毎回同じ庭になること(§6)。
```

**唯一の留保**: 高水位マーク(`garden-high-water:v1:{userId}`)は端末ローカルなので、
旧端末の高水位がサーバーの現在値より大きかった場合、新端末では**サーバー値まで下がった庭**が描かれる。
これは「シードが違う=別の庭」ではなく「同じ庭の、より若い段階」であり、事故の質がまったく違う(→ Q6・棚卸し #12)。

**確度**: 確定。

#### Q1-4. シードを受け取る関数の呼び出し経路(コールチェーン)

シードは**引き回されていない**。各生成箇所で定数から直接作られ、その場で消費される。

```
[ホーム]
app/(app)/(tabs)/index.tsx:150  loadGrowth(session.user.id)
  └→ components/garden/load.ts:54  loadGrowth()
       ├→ supabase.from('measured_saved' / 'measured_daily')      … 数値のみ
       ├→ AsyncStorage 'garden-high-water:v1:{userId}'            … 数値のみ
       ├→ lib/garden/growth.ts:64  mergeHighWater(prev, next)
       └→ lib/garden/growth.ts:48  deriveGrowth(snapshot) → GrowthParams
                                                              │ ※シードを含まない
app/(app)/(tabs)/index.tsx:425  <HomeGarden growth={growth} … />
  └→ components/garden/HomeGarden.tsx:67  bakeComposite(buildScene(g), opts)
       └→ lib/garden/scene.ts:821  buildScene(g: GrowthParams)
            ├→ (モジュール初期化時) COBBLE_STYLES  ← mulberry32(COBBLE_JITTER_SEED)  定数
            ├→ (モジュール初期化時) COBBLE_SHAPES  ← mulberry32(COBBLE_SHAPE_SEED)   定数
            ├→ (モジュール初期化時) WING          ← mulberry32(WING_SEED)           定数
            └→ buildBambooLayer()  ← mulberry32(31) / mulberry32(7) / mulberry32(51) 定数

[庭モード(絵巻)]
app/(app)/garden.tsx:45  loadGrowth(session.user.id).then(setGrowth)
  └→ components/garden/GardenScroll.tsx:68  buildScene(growth)   … 以下ホームと同一
```

`GrowthParams` の型定義(`lib/garden/growth.ts:31-44`)にシード相当のフィールドは無い。

**確度**: 確定。

> **補足への回答**: 指示書が想定した最悪ケース(端末生成の乱数 + AsyncStorage のみの永続化)には**該当しない**。
> 復元後に「時間は戻ったのに別の庭が生える」事故は起きない。冒頭に太字で書く必要のある事案は無かった。

---

### Q2. 基準線スナップショットの保存先

#### Q2-1. 宣言時に確定した基準線はどこに書き込まれているか

**結論**: **Supabase `measured_vows.baseline_minutes`**(`numeric not null check (baseline_minutes >= 0)`)。端末のみ保持ではない。

**根拠**:

```sql
-- supabase/001_schema.sql:16-26
create table if not exists measured_vows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_name text not null,
  app_label text not null,
  baseline_minutes numeric not null check (baseline_minutes >= 0),
  baseline_window_days integer not null,
  declared_on date not null default ((now() at time zone 'Asia/Tokyo'))::date,
  ...
```

書き込みは宣言時の `insert` 1箇所のみ:

```
app/(app)/declare.tsx:122-128
    const { error } = await supabase.from('measured_vows').insert({
      user_id: session.user.id,
      package_name: packageName,
      app_label: label,
      baseline_minutes: baseline.averageMinutesPerDay,
      baseline_window_days: baseline.windowDays,
    });
```

値の出どころは `computeBaseline()`:

```
lib/baseline.ts:47-60
export function computeBaseline(packageName: string, now: number = Date.now()): BaselineResult {
  const { availableDays, window } = measureBaselineWindow(now);
  if (availableDays < BASELINE_MIN_DAYS) {
    return { status: 'insufficient', availableDays };
  }
  return { status: 'ok', averageMinutesPerDay: averageMinutesPerDay(window, packageName), windowDays: availableDays };
}
```

**確度**: 確定。

#### Q2-2. 基準線の算出に使った窓の情報は保存されているか

**結論**: **保存されている。** `measured_vows.baseline_window_days`(`integer not null`)に `availableDays` がそのまま入る。

**根拠**:

- 定数: `lib/baseline.ts:13-14` — `BASELINE_MAX_DAYS = 84`(12週) / `BASELINE_MIN_DAYS = 28`
- `availableDays` の算出: `lib/baseline.ts:31-43` の `measureBaselineWindow()` が
  日次→週次→月次を継ぎ足した窓(`stitchBaselineWindow`)から `coveredDaysOf(window)` を取る
- `BaselineResult` の `windowDays` は `availableDays` そのもの(`lib/baseline.ts:58` — `windowDays: availableDays`)
- それが `baseline_window_days` へ入る(`app/(app)/declare.tsx:127`)

したがって復元後も「その基準線は何日ぶんの平均か」を検証できる。
実際、宣言画面の表示もこの値から週数を出している(`app/(app)/declare.tsx:302` — `Math.round(baseline.windowDays / 7)`)。

**確度**: 確定。

#### Q2-3. 宣言後に基準線が更新される経路は存在しないか

**結論**: **存在しない。** 五原則③違反は無い。

**根拠**: `baseline_minutes` / `baseline_window_days` を含む全参照箇所を洗い出した結果、**書き込みは `declare.tsx:126-127` の `insert` のみ**で、`update` は 1 件も無い。

| ファイル:行 | 操作 |
|---|---|
| `app/(app)/declare.tsx:126-127` | **insert(唯一の書き込み)** |
| `app/(app)/declare.tsx:82, 89, 105, 255` | select / 表示(復帰モードで固定値を出すだけ) |
| `app/(app)/vow/[vowId].tsx:68, 104, 164` | select / 表示 |
| `app/(app)/(tabs)/index.tsx:84, 486-487` | select / 表示 |
| `lib/vow-log-cache.ts:16` | 端末キャッシュの型 |
| `lib/articles/evaluate.ts:78, 83` | select(記事の発火判定) |
| `lib/vow-log.ts:5` | コメント |

`measured_vows` への `update` は 2 箇所しか無く、どちらも `graduated_on` のみを触る:

```
app/(app)/graduate.tsx:51-54   .update({ graduated_on: getTodayTokyoDate() })   // 卒業
app/(app)/declare.tsx:161-164  .update({ graduated_on: null })                  // 復帰
```

復帰経路が基準線を再計算しないことは、コード上のコメントでも明示されている:

```
app/(app)/declare.tsx:155-156
// 復帰(卒業機能 §5-3)。graduated_on を NULL に戻すフリップだけ。行の作り直しも
// 再宣言もせん ── declared_on も基準線も、宣言したその日のまま動かない。
```

**確度**: 確定。

> **補足への回答**: 「基準線が端末のみ → 復元前に Supabase へ昇格させる移行が必須」という懸念は**該当しない**。
> 基準線も窓日数も宣言時点から Supabase にあり、復元フロー本体の前にデータ移行を挟む必要は無い。

---

## 2. A分類の同期実態

### Q3. Supabaseスキーマの現状

**結論**: 実測版で実際に使われるのは **テーブル5本 + ビュー2本 + 関数2本**。棚卸し表の `yaranai_items` / `daily_records` は自己申告版の名称であり、実測版には存在しない。

**根拠**: `apps/yaranai-measured/supabase/` 配下の 4 ファイルを全文読了。
`yaranai_items` / `daily_records` の定義は `apps/yaranai/supabase/001_mvp_schema.sql`(自己申告版)にのみ存在する。

#### 対応表

| 棚卸し表の旧表記 | 実測版の実体 | 種別 | 定義 |
|---|---|---|---|
| `yaranai_items` | `measured_vows` | テーブル | `001_schema.sql:16-26` + `003_graduation.sql:37` |
| `daily_records` | `measured_daily` | テーブル | `001_schema.sql:68-76` |
| — | `measured_saved` | **ビュー** | `003_graduation.sql:105-122` |
| — | `garden_state` | **ビュー** | `003_graduation.sql:127-135` |
| — | `excuse_declarations` | テーブル | `002_excuse_declarations.sql:30-38` |
| — | `app_events` | テーブル | `002_excuse_declarations.sql:96-102` |
| — | `terms_acceptances` | テーブル | `004_terms_acceptances.sql:12-19` |

#### カラム一覧

**`measured_vows`**(`001_schema.sql:16-26`, `003_graduation.sql:37`)
`id` uuid PK / `user_id` uuid NOT NULL FK→auth.users ON DELETE CASCADE / `package_name` text NOT NULL /
`app_label` text NOT NULL / `baseline_minutes` numeric NOT NULL CHECK(>=0) / `baseline_window_days` integer NOT NULL /
`declared_on` date NOT NULL DEFAULT (now() at tz 'Asia/Tokyo')::date / `discontinued_on` date /
`created_at` timestamptz NOT NULL DEFAULT now() / **`graduated_on` date**(003 で追加)

制約: `measured_vows_active_pkg`(unique, `where discontinued_on is null`, `001:36-37`) /
`check_measured_vow_limit()` トリガー(挑戦中3本まで, `003:54-73`)

**`measured_daily`**(`001_schema.sql:68-76`)
`id` uuid PK / `user_id` uuid NOT NULL FK / `vow_id` uuid NOT NULL FK→measured_vows ON DELETE CASCADE /
`record_date` date NOT NULL / `actual_minutes` integer NOT NULL CHECK(>=0) / `created_at` timestamptz /
**`unique (vow_id, record_date)`**

**`measured_saved`(ビュー)**(`003_graduation.sql:105-122`)
`vow_id` / `user_id` / `package_name` / `app_label` / `baseline_minutes` / `baseline_window_days` /
`declared_on` / `discontinued_on` / **`graduated_on`**(003 で追加) / `measured_days`(=`count(d.id)`) /
`saved_minutes`(=`sum(greatest(0, baseline_minutes - actual_minutes))`) / `saved_hours`
※ `measured_vows` を **left join** し、**vow の状態による where 句を一切持たない**(全行が集計対象)

**`garden_state`(ビュー)**(`003_graduation.sql:127-135`)
`user_id` / `total_saved_hours` / `longest_days` / `phase`(=`greatest(0.05, least(1.0, round(hours/210, 3)))`)

**`excuse_declarations`**(`002:30-38`): `id` / `user_id` / `what_text` text NOT NULL CHECK(btrim長>0) / `declared_on` date / `created_at` / `superseded_at` timestamptz
**`app_events`**(`002:96-102`): `id` / `user_id` / `event` text / `payload` jsonb / `created_at`
**`terms_acceptances`**(`004:12-19`): `id` / `user_id` / `terms_version` / `privacy_version` / `accepted_at` / `created_at`

**関数**: `declare_excuse(p_what_text text)`(`002:64-85`、security invoker) / `check_measured_vow_limit()`(`003:54-68`)

#### RLS(復元時に他人のデータを引かないことの担保)

| オブジェクト | 状態 | 根拠 |
|---|---|---|
| `measured_vows` | `enable row level security` + `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` | `001:28-33` |
| `measured_daily` | 同上 | `001:78-83` |
| `excuse_declarations` | 同上 | `002:40-46` |
| `app_events` | 同上 | `002:104-110` |
| `terms_acceptances` | RLS 有効。select / insert のみポリシーあり(update/delete は不可) | `004:21-30` |
| `measured_saved` / `garden_state` | `with (security_invoker = true)` — 基底テーブルの RLS が効く | `003:106, 128` |

**すべて `user_id` で閉じている。** ビューにも `security_invoker` が付いており、RLS のすり抜けは無い(`001:90-91` に注意書きあり)。

**確度**: 確定。ただし**これは SQL ファイルの内容であって、本番 Supabase プロジェクトに実際に適用済みかは未確認**。
確定させるには本番プロジェクトの `information_schema` / `pg_policies` を直接照会する必要がある(このタスクの権限外)。
なお、コード側には 003 未適用環境への耐性が入っている(`lib/vows.ts:16-20` の `isMissingGraduatedOn`)ことから、
**未適用のプロジェクトが実在しうる前提で書かれている**点は復元フロー設計時に留意が要る。

---

### Q4. 日次記録の欠落可能性

#### Q4-1. `syncMeasuredDaily` は過去何日分を遡って upsert しているか

**結論**: 定数は **`LOCAL_SYNC_DAYS = 7`**。ただし実際に upsert されるのは **`i = 1..6`(昨日〜6日前)の最大6日分**で、7日前は含まれない。

**根拠**:

```
lib/usage-sync.ts:18   const LOCAL_SYNC_DAYS = 7; // OSの日次統計・イベントの保持期間に合わせる
```

```
lib/usage-sync.ts:93-107
  for (const vow of vows as ActiveVow[]) {
    for (let i = 1; i < LOCAL_SYNC_DAYS; i++) {      // ← i = 1,2,3,4,5,6(6日分)
      const recordDate = recordDateDaysAgo(i);
      if (recordDate >= today) continue;
      if (recordDate < vow.declared_on) continue;
      const minutes = await getMinutesForPackage(vow.package_name, recordDate);
      if (minutes == null) continue;                  // ← 端末に行が無い日は送らない
      upserts.push({ user_id: userId, vow_id: vow.id, record_date: recordDate, actual_minutes: minutes });
```

一段手前の端末内DB充填(`syncLocalUsage`)は `i = 0..6`(当日+6日前まで=7暦日):

```
lib/usage-sync.ts:41-43
  for (let i = 0; i < LOCAL_SYNC_DAYS; i++) {
    targetDates.push(recordDateDaysAgo(i));
  }
```

当日を送らないのは意図的(`lib/usage-sync.ts:70` — 「当日は未確定(まだ増える)やけん送らない」)。

**確度**: 確定。

#### Q4-2. 長期間起動しなかった場合、その間の日次記録は載るか

**結論**: **7日以上(正確には7暦日を超えて)アプリを開かなかった場合、その間の日次記録は永久に欠落する。**

**理由**(2つの壁が重なる):

1. **アプリ側の窓が7暦日しかない。** `syncLocalUsage` が OS に問い合わせる範囲は
   `beginMs = dayRange(recordDateDaysAgo(6)).beginMs` 〜 `now`(`lib/usage-sync.ts:41-47`)。
   6日前より古い日は、OS がまだ保持していても**一度も読みに行かない**。
2. **OS側の日次保持期間も7日。** `lib/usage-sync.ts:18` のコメントが明示。
   `lib/baseline.ts:27-28` にも「OSの保持期間は日次7日・週次4週・月次6ヶ月」とある。

**10日間起動しなかった場合の具体例**:
再起動時に埋まるのは当日〜6日前の7暦日のみ。**7日前〜10日前の4日分は端末内DB(`usage_daily`)に一度も書かれず、
`getMinutesForPackage` は `null` を返し(`lib/usage-db.ts:82`)、`measured_daily` への upsert は行われない**。
以後どの起動でもこの窓は開かないため、恒久欠落となる。

なお、基準線の集計だけは週次・月次バケットで84日を継ぎ足せる(`lib/baseline.ts:31-43`)が、
これは**宣言時の平均値算出専用**で、日次記録(`measured_daily`)の穴埋めには使われていない。

**確度**: 確定。

#### Q4-3. `syncAll` の例外握りつぶしが恒久的欠落になりうるか

**結論**: **なりうる。** ただし「握りつぶし」自体が原因ではなく、**リトライ窓が固定7日であること**が原因。

**根拠**:

```
lib/usage-sync.ts:117-124
export async function syncAll(userId: string): Promise<void> {
  try {
    await syncLocalUsage();
    await syncMeasuredDaily(userId);
  } catch {
    // 通信断・権限剥奪などは次回の起動で取り返す。利用者には何も言わない。
  }
}
```

コメントどおり、通常は次回起動で取り返せる。**取り返せなくなる経路は次の3つ**:

1. **`syncLocalUsage` が先に落ちると `syncMeasuredDaily` も走らない**(`try` ブロック内で直列、`:119-120`)。
   端末内DBの充填が7日間連続で失敗し続ければ、最も古い日から順に窓の外へ落ちていく。
2. **通信断が7日間続く**と、`syncMeasuredDaily` が届かないまま古い日が窓外へ出る。
   `syncMeasuredDaily` は「端末内DBにある日」ではなく「直近6日」だけを見るため、
   端末内DBに残っていても8日前の行を送り直す経路が無い(`lib/usage-sync.ts:94`)。
3. **使用状況アクセス権限が剥奪されている間**は `syncLocalUsage` が即 return する(`lib/usage-sync.ts:38`)。
   剥奪が7日を超えれば、その期間は恒久欠落。

さらに、この握りつぶしは**エラーを記録しない**(ログ出力も無い)。
復元フローの観点では、「サーバー側のデータが本当に完全か」を後から検証する手がかりが残らない。

**確度**: 確定(3経路とも行番号で示せる)。実際にどの頻度で起きるかは未計測。

#### Q4-4. 「行が存在しない日」と「使用時間0の日」の区別

**結論**: **正しく区別されている。** 端末側・サーバー側の両方で、区別は `null` と `0` の差として保たれる。

**根拠**:

**端末内DB(`usage_daily`)** — 「その日に1行でも観測があるか」を先に見る:

```
lib/usage-db.ts:78-90
export async function getMinutesForPackage(packageName: string, recordDate: string): Promise<number | null> {
  if (!(await hasAnyDataForDate(recordDate))) return null;      // ← 観測が1行も無い日 = null
  ...
  return Math.round((row?.ms ?? 0) / 60000);                     // ← 観測はあるが対象アプリの行が無い = 0
}
```

空の日を書かない方針も明示されている:

```
lib/usage-sync.ts:49-50
    // 空の日は書かない: 「データが無い日」と「使わなかった日」を区別できんため。
    // 行が一切ない日は同期対象外(=獲得0)として、嘘をつかない側に倒す。
```

**サーバー(`measured_daily`)**:
- `null`(データが無い日) → `continue` で upsert されない → **行が存在しない**(`lib/usage-sync.ts:99`)
- `0`(観測はあるが使わなかった日) → `actual_minutes = 0` の行が入る

**復元時の再計算で取り違えるか** — 取り違えない:
- `saved_minutes` = `sum(greatest(0, baseline_minutes - actual_minutes))`(`003_graduation.sql:118`)。
  `actual_minutes = 0` の日は**基準線ぶん満額が加算**され、行が無い日は **left join で寄与ゼロ**。
- 敷石(記録日数)= `measured_daily` の distinct `record_date`(`components/garden/load.ts:63`)。
  行が無い日は数えられず、0分の日は数えられる。
- 卒業判定も同じ区別を持つ(`lib/graduation.ts:53-56`。窓内に観測行が1日も無ければ**不成立**)。

**ただし復元フローへの含意**: 端末内DB(`usage_daily`)は復元後まっさらになるため、
**卒業判定は復元直後、必ず不成立になる**(`lib/graduation.ts:55` のガードに引っかかる)。
これはデータ破損ではなく設計どおりだが、復元直後に「卒業できたはずの誓いの導線が消える」体験になる。

**確度**: 確定。

---

### Q5. 理想・読みもの既読・卒業フラグ

#### Q5-1. 理想(掛け軸)のテキストの保存先

**結論**: **端末 AsyncStorage のみ。キー名 `yaranai.ideal.v1:{userId}`。Supabase へ送る経路は存在しない。**

**根拠**:

```
lib/ideal/storage.ts:1-2
// 理想(WHAT)の永続化層。AsyncStorage に端末ローカルで持つ(記事状態と同じローカルファースト)。
lib/ideal/storage.ts:9
const keyFor = (userId: string) => `yaranai.ideal.v1:${userId}`;
```

`loadIdeal` / `saveIdeal` の呼び出し元は 2 箇所だけで、いずれも表示・編集:

```
app/(app)/ideal.tsx:41, 67          loadIdeal(userId) / saveIdeal(userId, result.value)
components/IdealHeader.tsx:36       loadIdeal(userId)
```

`lib/ideal/` 配下に `supabase` の import は無く、`ideal` を含むカラムも SQL 4 ファイル中に存在しない。

**→ 移行が必要な項目。復元後、庭の直上の掛け軸が空になる。**

**確度**: 確定。

#### Q5-2. 読みもの(コラム)の既読状態の保存先

**結論**: **端末 AsyncStorage のみ。単一キー `yaranai.articles.state.v1`。user_id で分けていない。Supabase には送らない。**

**根拠**:

```
lib/articles/storage.ts:2
// AsyncStorage に単一キーで保持する。ローカルファースト方針に従い Supabase には送らない。
lib/articles/storage.ts:11-14
// 記事状態はユーザー横断の単一キー(端末ローカル)。庭の高水位と違い user_id で分けない
// ため、共有端末では前ユーザーの発火が残る可能性はあるが、記事は個人情報を含まず
// 「一度現れたものは消えない」原則にも沿うため v1 では単一キーで持つ。
const STATE_KEY = 'yaranai.articles.state.v1';
```

値の形は `{ [articleId]: { firedAt: string; readAt: string | null } }`(`lib/articles/types.ts:39-48`)。
`readAt === null` が未読。既読の記録は `app/(app)/reading/[id].tsx:28` の `recordRead()` のみ。

**→ 復元後は全記事が未発火に戻る**(常設記事が再び未読の帯として現れる)。移行するかは設計判断。

**確度**: 確定。

#### Q5-3. `graduated_on` の存在と、復元時に卒業済みの誓いが取得対象になるか

**結論**: `graduated_on` は **存在する**(`measured_vows.graduated_on` date、003 で追加)。
そして **卒業済みの誓いは `.is('discontinued_on', null)` の絞り込みで漏れない。** これは意図的な設計。

**根拠**:

列の定義:
```sql
-- supabase/003_graduation.sql:37
alter table measured_vows add column if not exists graduated_on date;
```

誓いの3状態(`003_graduation.sql:26-28`):
| 状態 | 条件 | 3本枠 | 同期 |
|---|---|---|---|
| active | `discontinued_on is null and graduated_on is null` | 数える | する |
| graduated | `discontinued_on is null and graduated_on is not null` | 数えない | **する** |
| discontinued | `discontinued_on is not null` | 数えない | しない |

**指示書が懸念した `lib/usage-sync.ts` の `.is('discontinued_on', null)` について** — これは
**卒業済み誓いを同期対象から外していない**。`graduated` は `discontinued_on is null` なので、この絞り込みを通過する。
コード上のコメントが、これを「この機能の芯」として明示的に守っている:

```
lib/usage-sync.ts:73-77
// 対象は discontinued_on is null の誓い ── つまり卒業済み(graduated_on あり)も
// ここに含まれる。これは意図的で、この機能の芯にあたる:
// 卒業は「挑戦の3枠から外れる」だけで、誓いそのものは生き続ける。ユーザーが
// 実際に取り戻しとる時間を庭が無視したら「消えない蓄積」の約束が崩れる。
// ゆえに、ここに and graduated_on is null を足してはならない。
```

```
lib/usage-sync.ts:80-83
  const { data: vows } = await supabase
    .from('measured_vows')
    .select('id, package_name, declared_on')
    .is('discontinued_on', null);
```

ビュー側も同じ:`measured_saved` は `measured_vows` を **left join するだけで where 句を持たない**
(`003_graduation.sql:120-122`)。したがって卒業済み・廃止済みの誓いの `saved_minutes` も
`garden_state` に合算され続ける(`003_graduation.sql:88-92` の設計メモに明記)。

庭のスナップショットも同様に全行を数える:
```
components/garden/load.ts:56, 61-62
  supabase.from('measured_saved').select('saved_minutes'),
  ...
  stoneCount: vows.length,            // ← 卒業済み・廃止済みも石として数える
```

**復元フローへの含意**: 復元時に誓いを引く際、`.is('graduated_on', null)` を足してはならない。
足すと卒業済みの誓いの取り戻し分が庭から消え、「消えない蓄積」の約束が破れる。
`discontinued_on` は現状すべて NULL(→ §5-1)なので、実質的な絞り込みにはなっていない。

**確度**: 確定。

---

## 3. B分類(再計算で復元できるはずのもの)

### Q6. 端末に保存されている状態の全列挙

**結論**: AsyncStorage キー **13種**(うち user_id 分離が 6種)、SQLite **1テーブル**、`SecureStore` は認証用のみ(除外指定どおり)。

**根拠**: `AsyncStorage.setItem` / `getItem` / `removeItem` / `multiRemove` / `SecureStore.*` を
`apps/yaranai-measured` と `packages/` 全体で grep。以下が全件。

#### AsyncStorage

| キー | 保存している値 | 書き込み元 | user_id 分離 | 分類 |
|---|---|---|---|---|
| `garden-high-water:v1:{userId}` | `GardenSnapshot`(`stoneCount` / `recordedDays` / `savedMinutes`) | `components/garden/load.ts:18, 74` | あり | B |
| `garden_last_seen_state:{userId}` | `GrowthParams`(前回表示時の庭) | `components/garden/load.ts:20, 35` | あり | B |
| `vow-log-snapshot:v1:{vowId}` | `VowLogSnapshot`(誓い別詳細の写し) | `lib/vow-log-cache.ts:22, 37` | vowId 分離 | B |
| `yaranai.ideal.v1:{userId}` | 理想(掛け軸)の本文テキスト | `lib/ideal/storage.ts:9, 24` | あり | **C** |
| `yaranai.excuse.current.v1:{userId}` | `ExcuseDeclaration`(現行の言い訳カード宣言。`pending` フラグ付き) | `lib/excuse/storage.ts:29, 41` | あり | A のキャッシュ |
| `yaranai.articles.state.v1` | `{ [articleId]: { firedAt, readAt } }` | `lib/articles/storage.ts:14, 27` | **なし** | **C** |
| `yaranai.language.v1` | `'ja'` / `'en'` | `lib/i18n/storage.ts:8, 21` | **なし** | C |
| `terms.consent` | `{ termsVersion, privacyVersion, acceptedAt, synced }` | `lib/terms.ts:23, 42, 76` | **なし** | A のキャッシュ |
| `onboarding.worldview_seen` | `'1'` | `lib/onboarding.ts:22, 39` | なし | C |
| `onboarding.pending_email` | メールアドレス文字列 | `lib/onboarding.ts:23, 59` | なし | C |
| `onboarding.disclosure_seen` | `'1'` | `lib/onboarding.ts:24, 39` | なし | C |
| `onboarding.permission_deferred` | `'1'` | `lib/onboarding.ts:25, 39` | なし | C |
| `onboarding.done.{userId}` / `onboarding.waiting.{userId}` | `'1'` | `lib/onboarding.ts:26-27, 39` | あり | C(導出で補える) |

#### SQLite

| DB / テーブル | 値 | 書き込み元 | 分類 |
|---|---|---|---|
| `yaranai-measured.db` / `usage_daily` | `record_date`, `package_name`, `foreground_ms`, `updated_at`(全アプリの日別前景時間) | `lib/usage-db.ts:17-27, 41-58` | **C** |

#### SecureStore(除外対象)

`packages/core/src/supabase.ts:19, 27, 49` — `LargeSecureStore` の暗号鍵。指示どおり除外。

#### 指示書が特に挙げた4項目

| 確認対象 | 実体 |
|---|---|
| **苔(累計取り戻し時間)のキャッシュ** | 専用キーは無い。`garden-high-water:v1:{userId}` の `savedMinutes` フィールドがそれに当たる(`components/garden/load.ts:74` で `GardenSnapshot` 全体を JSON 保存)。正本は `measured_saved.saved_minutes`(Supabase) |
| **高水位マーク(`mergeHighWater` が参照する値)** | `garden-high-water:v1:{userId}`。読みは `components/garden/load.ts:68`、`mergeHighWater(prev, snapshot)` へ渡り(`:73`)、`lib/garden/growth.ts:64-74` で3フィールドを `Math.max` 合成 |
| **敷石(記録日数 n)・継続週数 w** | どちらも**独立して保存されていない**。`recordedDays` は上記高水位に含まれ、`weeks` は `deriveGrowth` 内で `Math.floor(days / 7)` として毎回導出(`lib/garden/growth.ts:50`)。敷石の枚数も `cobbleCount(recordedDays)` で導出(`lib/garden/scene.ts:312-317`) |
| **`prevGrowth` の供給元** | `AsyncStorage 'garden_last_seen_state:{userId}'` → `loadLastSeen()`(`components/garden/load.ts:23-30`)→ `app/(app)/(tabs)/index.tsx:190-192` で `setPrevGrowth` → `index.tsx:425` で `<HomeGarden prevGrowth={prevGrowth} />` へ。書き戻しは同 `:196` の `saveLastSeen(session.user.id, growthRes)` |

#### アカウント削除時に消されるキー

参考(復元フローの「削除→再登録」設計の材料):

```
lib/account-deletion.ts:26-33
    await clearAllUsageData();            // SQLite usage_daily を全削除
  ...
  await AsyncStorage.multiRemove([
    `garden-high-water:v1:${userId}`,
    `garden_last_seen_state:${userId}`,
  ]).catch(() => {});
```

**消し残るキー**: `yaranai.ideal.v1:{userId}` / `yaranai.excuse.current.v1:{userId}` /
`yaranai.articles.state.v1` / `vow-log-snapshot:v1:{vowId}` / `onboarding.*` / `terms.consent` / `yaranai.language.v1`。
→ §5-3 の想定外事項として記録。

**確度**: 確定(grep 全件確認済み)。

---

### Q7. 苔の満開基準(210時間)のフロント・バック一致

#### Q7-1. `lib/garden/growth.ts` の `MOSS_FULL_HOURS` の現在値

**結論**: **210**。

```
lib/garden/growth.ts:19   export const MOSS_FULL_HOURS = 210;
lib/garden/growth.ts:14   // 苔の満開基準。garden_state ビューの規則(210時間 = 1.0)と同一。
lib/garden/growth.ts:56     moss: clamp01(s.savedMinutes / 60 / MOSS_FULL_HOURS),
```

**確度**: 確定。

#### Q7-2. `garden_state` ビュー側の分母の現在値

**結論**: **210**。001 と 003 の両方で同値。

```sql
-- supabase/001_schema.sql:121
  greatest(0.05, least(1.0, round((sum(saved_minutes)::numeric / 60) / 210, 3))) as phase
-- supabase/003_graduation.sql:133 (001 と同一。measured_saved を落とした巻き添えで作り直しただけ)
  greatest(0.05, least(1.0, round((sum(saved_minutes)::numeric / 60) / 210, 3))) as phase
```

**確度**: 確定(SQL ファイル上の値として)。本番 Supabase に適用済みのビュー定義は未確認。

#### Q7-3. 両者は一致しているか / どちらが表示に効いているか

**結論**: **一致している(210 = 210)。**

なお、**実際の庭の描画に効いているのはフロント側の `MOSS_FULL_HOURS` だけ**である。
`garden_state.phase` は庭の描画には使われていない:

```
components/garden/load.ts:55-64   // 庭は measured_saved.saved_minutes と measured_daily.record_date だけを読む
app/(app)/(tabs)/index.tsx:144    supabase.from('garden_state').select('longest_days').maybeSingle();
                                  //                            ^^^^^^^^^^^^ phase は選択していない
```

`garden_state` から取得しているのは `longest_days` のみ(ホームの「◯日目」表示用)。
仮に SQL 側の 210 がずれても庭の見た目は変わらないが、**逆方向の検算が効かなくなる**ため、
両者を一致させておくこと自体には意味がある(SQL コメント `001:114` / `003:125` も「一致させること」と指示している)。

**確度**: 確定。

#### Q7-4. README・コード・SQL の3箇所の突き合わせ

**結論**: **指示書の前提と異なり、`720` という記述は README にもリポジトリ内のどの Markdown にも存在しない。3箇所すべて 210 で一致している。**

**根拠**:

```
$ grep -rn "720" --include="*.md" .        # node_modules 除外
(該当なし)
$ git log -S"720" -- apps/yaranai-measured/README.md
(該当なし — 過去のコミットにも一度も存在しない)
```

README 側の記述(3箇所すべて 210):

```
apps/yaranai-measured/README.md:71
- 庭のphase = 累計取り戻し時間(時間) ÷ 210、下限0.05、上限1.0(`MOSS_FULL_HOURS` と一致)
apps/yaranai-measured/README.md:223
苔=累計取り戻し時間(210h=満開、`MOSS_FULL_HOURS` と同一) / 竹・靄・光・影=継続週数 w=floor(n/7) /
apps/yaranai-measured/README.md:376
- 苔スライダーの上限は `MOSS_FULL_HOURS`(=210時間で満開)を import して使う。
```

突き合わせ表:

| 箇所 | 値 | 根拠 |
|---|---|---|
| コード | 210 | `lib/garden/growth.ts:19` |
| SQL(001) | 210 | `supabase/001_schema.sql:121` |
| SQL(003) | 210 | `supabase/003_graduation.sql:133` |
| README ×3 | 210 | `README.md:71, 223, 376` |
| 補助ドキュメント | 210 | `apps/yaranai-measured/docs/yaranai-list.md:59` |

**食い違いは無い。README の修正は不要**(そもそも修正対象が存在しない)。
指示書の「README に 720 が残っている」という前提は、現在の HEAD では成立しない。
別ブランチ・別の未マージのドキュメントを指していた可能性はあるが、それは本調査の範囲外。

**確度**: 確定(`main` にマージ済みの `b37443d` 時点。全 Markdown を grep 済み)。

---

### Q8. C分類の独立性

**結論**: **庭の成長パラメータ計算は `usage_daily`(端末SQLite)を直接参照していない。依存経路は存在しない。**

**根拠**:

`lib/garden/growth.ts` の入力は `GardenSnapshot` 型のみ:

```
lib/garden/growth.ts:22-29
export type GardenSnapshot = {
  stoneCount: number;
  recordedDays: number;
  savedMinutes: number;
};
lib/garden/growth.ts:48   export function deriveGrowth(s: GardenSnapshot): GrowthParams {
```

`GardenSnapshot` を作る箇所は **2つだけ**:

1. **本番経路** — `components/garden/load.ts:54-76` の `loadGrowth()`。入力は Supabase と AsyncStorage のみ:
   ```
   components/garden/load.ts:55-58
     const [savedRes, daysRes] = await Promise.all([
       supabase.from('measured_saved').select('saved_minutes'),
       supabase.from('measured_daily').select('record_date'),
     ]);
   components/garden/load.ts:68   const raw = await AsyncStorage.getItem(keyFor(userId));
   ```
2. **開発者モード専用** — `components/garden/load.ts:45-52` の `buildGrowthFromDebug(days, savedHours)`。
   スライダーの数値のみ。`AsyncStorage` も高水位も通さない(`:42-44` のコメント)。

`lib/garden/` 配下の全ファイル(`growth.ts` / `scene.ts` / `prng.ts` / `bamboo.ts` / `dims.ts` /
`diff.ts` / `gate.ts` / `tokens.ts` / `scene-types.ts` / `preview-svg.ts`)に
`usage-db` の import は 1件も無い。`components/garden/` 配下も同様。

**`usage_daily` の実際の読み出し先**(庭以外):

| 用途 | 関数 | 呼び出し元 |
|---|---|---|
| Supabase への日次同期 | `getMinutesForPackage` | `lib/usage-sync.ts:98` |
| 卒業判定 | `getRecordedDatesSince` / `getPackageForegroundMsByDateSince` | `lib/graduation-check.ts` |
| 「時間の行き先」の候補 | `getWeeklyTopApps` | `app/(app)/observe.tsx` |
| アカウント削除 | `clearAllUsageData` | `lib/account-deletion.ts:26` |

**注意すべき間接依存**: `usage_daily` は `measured_daily` への**書き込み源**である
(`lib/usage-sync.ts:98-107`)。つまり「復元後に庭が再現できるか」という問いには
**Yes(既に Supabase にある日次行から完全に再現できる)**だが、
**「復元後の新しい日から先も正しく積み上がるか」は権限再付与に依存する**。
使用状況アクセスが再付与されるまで `syncLocalUsage` は即 return し(`lib/usage-sync.ts:38`)、
`measured_daily` に新しい行が入らない。庭は止まったまま(後退はしない)になる。

**確度**: 確定。

---

## 4. 想定外の事項(直していない。報告のみ)

### 4-1. 仕様と実装の食い違い

1. **`discontinued_on` に書き込むコードが1行も存在しない。**
   `supabase/001_schema.sql:24` に列があり、`lib/usage-sync.ts:83` / `app/(app)/observe.tsx:65, 70` /
   `app/(app)/settings.tsx:37, 45` / `app/(app)/declare.tsx:31, 37, 84, 91` /
   `app/(app)/(tabs)/index.tsx:240` と**10箇所が読み取り条件として使っている**が、
   `update({ discontinued_on: ... })` に相当する記述はアプリ全体に無い。
   誓いを「やめる」導線は現在の実装に存在せず、`003_graduation.sql:28` が定義する
   discontinued 状態は**到達不能**である。復元フローでこの列を条件に入れても実質的な絞り込みにはならない。

2. **指示書が前提とした「README の 720」が存在しない。**
   Q7-4 のとおり、全 Markdown・全コミット履歴を通じて `720` は一度も現れない。
   README・コード・SQL はすべて 210 で一致している。

3. **`garden_state.phase` が一度も読まれていない。**
   `supabase/001_schema.sql:121` / `003_graduation.sql:133` で定義され、`README.md:71` にも仕様として
   書かれているが、アプリが `garden_state` から取るのは `longest_days` のみ
   (`app/(app)/(tabs)/index.tsx:144`)。苔の充実度はフロント側の `MOSS_FULL_HOURS` で毎回計算される。
   値としては一致しているので実害は無いが、**SQL 側を変えても画面は変わらない**点は把握しておく必要がある。

### 4-2. 復元フローに影響しそうな未処理のエッジケース

4. **6日を超える起動間隔で日次記録が恒久欠落する(Q4-2)。**
   復元フローとは独立した既存の穴だが、「復元後に庭が縮んで見える」原因になりうる。
   端末の高水位マーク(`garden-high-water:v1:{userId}`)が旧端末でこの欠落を覆い隠していた場合、
   新端末ではサーバーの実値まで庭が後退する。

5. **`pending: true` のまま端末が失われた言い訳カード宣言はサーバーに届かない。**
   `lib/excuse/storage.ts:186-194` は、サーバー書き込みが3段とも失敗したとき
   `id: local-{timestamp}` の宣言を端末に預ける。押し直しは
   `loadCurrentDeclaration()`(`:67-75`)が次回起動で行うが、その起動が来る前に
   アンインストールされれば宣言は失われる。「カード宣言はアンインストールで消えてはならない」
   (`002_excuse_declarations.sql:24-25` / `lib/excuse/storage.ts:3-4`)という明示的な約束に穴がある。

6. **アカウント削除が AsyncStorage を2キーしか消さない。**
   `lib/account-deletion.ts:30-33` が消すのは `garden-high-water:v1:{userId}` と
   `garden_last_seen_state:{userId}` のみ。**理想(`yaranai.ideal.v1:{userId}`)・
   言い訳カードのキャッシュ(`yaranai.excuse.current.v1:{userId}`)・読みもの状態
   (`yaranai.articles.state.v1`)・誓い別ログの写し(`vow-log-snapshot:v1:{vowId}`)は端末に残る。**
   同じ端末で同じ user_id が再発行されることはないため前ユーザーへの漏洩は起きにくいが、
   `yaranai.articles.state.v1` は user_id 非分離なので、削除→再登録した本人には既読状態が残る。
   §6 の「削除→再登録を『新規』として扱う」設計を決める際の材料になる。

7. **復元直後は卒業判定が必ず不成立になる。**
   `lib/graduation.ts:53-56` のガード(窓内に観測行が1日も無ければ不成立)により、
   端末内DBが空の復元直後は、実際には7日以上使っていない誓いでも卒業導線が出ない。
   最短で7日後(端末内DBに観測が溜まってから)。データ破損ではないが、
   「復元したのに卒業できたはずのものが消えた」という体験になる。

8. **`onboarding.done.{userId}` の導出フォールバックが `discontinued_on` だけを見ている。**
   `app/(app)/(tabs)/index.tsx:236-243` は誓いの件数を `.is('discontinued_on', null)` で数え、
   0件なら未完了として時間の行き先へ飛ばす。`discontinued_on` は常に NULL なので現状は問題ないが、
   将来「やめる」導線が実装されると、**全誓いをやめた既存ユーザーがオンボーディングに再突入する**。

9. **`terms.consent` が復元後に存在しないため、規約同意の再送が走らない。**
   `lib/terms.ts:50-57` は端末のローカル記録が無ければ即 return する。
   正本は `terms_acceptances` にあるので実害は無いが、復元フローで
   「同意済みかどうか」を端末側の印で判定してはならない。

### 4-3. ドキュメント・コメントと現行実装の食い違い

10. **`lib/garden/growth.ts:2` のテストファイル参照先が実在しない。**
    「テストは lib/__tests__/garden-growth.test.ts」とあるが、実際のファイルは
    `lib/__tests__/garden.test.ts`。

11. **`lib/usage-sync.ts:18` のコメントが窓の実体とずれている。**
    `LOCAL_SYNC_DAYS = 7` に「OSの日次統計・イベントの保持期間に合わせる」と付いているが、
    `syncMeasuredDaily` のループは `i = 1..6`(`:94`)で**6日分**しか upsert しない。
    定数名と実際の同期日数が1日ずれており、Q4-2 の欠落境界を読み違えやすい。

12. **`components/garden/load.ts:3` のコメントが実装より広い。**
    「石 = `measured_saved` の行数(やめた誓いも含む宣言の総数)」とあるが、
    `deriveGrowth` は `Math.min(3, ...)` で 3 に丸める(`lib/garden/growth.ts:52`)。
    誓いを4本以上宣言した履歴があっても石は3つまで。

---

## 5. 本調査で答えを出していないもの

指示書 §6 のとおり、以下は設計判断として人間に委ねる。判断材料となる事実のみ上記に記載した。

- シードの正本方式(そもそも定数なので、この判断自体が不要になった可能性がある → Q1)
- 空白期間を挟んだときの継続週数 w のルール(w は `floor(recordedDays / 7)` で毎回導出される点のみ提示 → Q6)
- 復元中のローディング演出
- 削除→再登録を「新規」として扱う際の実装(消し残るキーの一覧のみ提示 → §4-2-6)
