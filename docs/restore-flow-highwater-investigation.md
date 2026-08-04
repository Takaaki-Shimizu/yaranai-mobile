# 追加調査報告書 — 高水位マーク（`mergeHighWater`）は何を守っているか

対象: `apps/yaranai-measured` のみ / 調査日: 2026-08-04 / HEAD: `b37443d`
前提: `restore-flow-investigation-report.md`（同日）の続き
調査種別: **read-only**。コード変更・マイグレーション新規作成は行っていない。

---

## 0. 結論（先に）

> **`mergeHighWater` を削除した場合、実際に庭が後退するユーザーは存在するか。存在するなら、それはどの経路によるものか。**

**存在する。経路は R3（取得失敗が空配列として扱われる経路）ただ一つであり、
通信断・認証切れ・RLS拒否・スキーマ未適用のいずれかが起きた起動で、
`stoneCount` / `recordedDays` / `savedMinutes` の3つが同時に 0 に落ちる。**

指示書の疑い（「`measured_daily` は追記のみ、`measured_saved` は単純合計だから集計値は単調非減少ではないか」）は
**サーバー側については正しい**。行の削除経路も、集計値を縮める経路も存在しない。
しかし**クライアント側**に、エラーを検査せず `data ?? []` で握りつぶす箇所があり、
そこで「取得できなかった」が「値が 0 だった」に化ける。

したがって `mergeHighWater` は**欠落日を守る保険ではなく、通信断を守る保険**である。
前回の報告書の記述（「サーバー側に欠落日がある場合に庭が後退して見える」）は**誤り**であり、§4 で訂正する。

さらに、後退の実害は「庭が若返る」に留まらない。`stoneCount` が 0 になると
**ホームは庭を描画せず、宣言前の空状態の文言に落ちる**（`app/(app)/(tabs)/index.tsx:423-431`）。

---

## 1. 結論表

| 経路 | 後退は起きるか | 再現条件 | 影響するフィールド | 根拠 |
|---|---|---|---|---|
| **R1-1** `measured_daily` の delete | **起きない** | — | — | `.delete()` の呼び出しがリポジトリ全体に **0件**（下記 §2.1） |
| **R1-2** upsert による上書き | **通常運用では起きない**（`actual_minutes` は再計算のたびに減る方向にしか動かない）。端末の暦日境界が動く場合のみ増加しうる | タイムゾーン変更・端末時計の手動変更 | `savedMinutes` | `lib/usage-events.ts:34-35, 79` / `lib/usage-sync.ts:109-113` |
| **R1-3** `measured_vows` のカスケード削除 | **起きない**（アカウント削除以外に経路なし） | — | — | `.delete()` 0件 / Edge Function は `auth.users` のみ削除 |
| **R2-1** ビュー定義の差分（001→003） | **起きない** | — | — | 差分は `v.graduated_on` の1行追加のみ（下記 §3.1） |
| **R2-2** 003 未適用環境 | **起きない** | — | — | `loadGrowth` は `graduated_on` を select しない（`components/garden/load.ts:56-57`） |
| **R3-1,2** 取得失敗時のフォールバック | **起きる（唯一の実在経路）** | 通信断 / 認証切れ / RLS拒否 / `001_schema.sql` 未適用 | **`stoneCount`・`recordedDays`・`savedMinutes` の3つ同時** | `components/garden/load.ts:59, 63` の `?? []` |
| **R3-4** PostgREST の行数上限 | **見た目の後退は起きない**（`deriveGrowth` が 84日でクランプするため）。生の `recordedDays` のみ縮みうる | `measured_daily` の総行数が上限を超える | `recordedDays`（診断情報の表示値のみ） | `lib/garden/growth.ts:50, 54` / `app/(app)/settings.tsx:71` |

---

## 2. R1 — `measured_daily` の行が削除・更新される経路

### R1-1. `measured_daily` に対する `delete` を発行するコードは存在するか

**結論**: **存在しない。** Supabase に対する `.delete()` は、リポジトリ全体で **0件**。

**根拠**:

```
$ grep -rn "\.delete()" --include="*.ts" --include="*.tsx" apps/yaranai-measured packages
(該当なし)
```

`measured_daily` に対する書き込みは upsert 1箇所のみ:

```
lib/usage-sync.ts:109-113
  if (upserts.length > 0) {
    await supabase
      .from('measured_daily')
      .upsert(upserts, { onConflict: 'vow_id,record_date' });
  }
```

（端末内 SQLite 側には `delete` があるが（`lib/usage-db.ts:47, 124`）、これは `usage_daily` テーブルであって
`measured_daily` ではない。前回報告 Q8 のとおり、`usage_daily` は庭の計算に接続していない。）

**確度**: 確定。

### R1-2. upsert によって既存行の `actual_minutes` がより大きい値で上書きされることはあるか

**結論**: **上書き自体は起きる。しかし通常運用では `actual_minutes` は減る方向にしか動かず、`savedMinutes` の後退にはならない。**
増加しうるのは、端末の暦日境界そのものが動いた場合（タイムゾーン変更・時計の手動変更）に限られる。

#### 上書きは起きるか

起きる。`upsert(..., { onConflict: 'vow_id,record_date' })` は既定で衝突行を**更新**する
（`ignoreDuplicates` を指定していない）。同じ `(vow_id, record_date)` は毎起動で送り直される
（`lib/usage-sync.ts:94-107` のループが i=1..6 を無条件に回す）。

端末内DB側も同様に洗い替えである:

```
lib/usage-db.ts:41-58
export async function replaceDay(recordDate: string, rows: ...): Promise<void> {
  ...
    await tx.runAsync('delete from usage_daily where record_date = ?', recordDate);
    for (const row of rows) { ... insert ... }
```

#### 再計算の値は増えるか、減るか

**減る方向にしか動かない。** 理由は、イベント積み上げの窓が毎日 1 日ぶん前へ滑るのに対し、
**窓の始まりより前から続いていた前景区間を数えない**規則があるためである:

```
lib/usage-events.ts:34-35
//   - 窓の始まりより前から前景やった断片(先頭の PAUSED だけ来る)は数えない。
//     確かめようが無いけん、過少(嘘をつかない)側に倒す
lib/usage-events.ts:79
      if (!state) continue; // 窓の始まりより前から前景やった断片は数えない
```

窓の始まりは常に「6日前の 0 時」に固定されている:

```
lib/usage-sync.ts:41-46
  for (let i = 0; i < LOCAL_SYNC_DAYS; i++) { targetDates.push(recordDateDaysAgo(i)); }
  const { beginMs } = dayRange(targetDates[targetDates.length - 1]);
  ...
  const byDayFromEvents = aggregateEventsByDay(queryUsageEvents(beginMs, now), targetSet, now);
```

**具体例**（日付をまたぐ視聴が窓の縁に来たとき）:

- ある日 D の起動時、日付 X = D−5 は窓の内側（窓の始まりは D−6 の 0 時）。
  D−6 の 23:50 に始まり X の 00:20 に終わった区間は、`addInterval` が暦日で割るため
  X に 20 分が計上される（`lib/usage-events.ts:45-58`）。この値が upsert される。
- 翌日 D+1 の起動時、同じ日付 X は i=6 に下がり、窓の始まりが X の 0 時そのものになる。
  区間の RESUMED（D−6 23:50）は窓の外なので `open` に入らず、X の 00:20 に来る PAUSED は
  `lib/usage-events.ts:79` で捨てられる。**X の値は 20 分減る。**
- 減った `actual_minutes` が upsert され、`greatest(0, baseline − actual)` は**増える**。

つまりこの経路は `savedMinutes` を**増やす**方向にしか働かない。

当日ぶんの膨張（進行中の区間を `now` で打ち切って数える。`lib/usage-events.ts:95-98`）が
サーバーへ漏れることも無い。当日は送信対象から外れているためである:

```
lib/usage-sync.ts:96
      if (recordDate >= today) continue;
```

また、イベントが完全に消えた日は端末内DBを上書きしない（空で潰さない）:

```
lib/usage-sync.ts:51-59
    const eventRows = byDayFromEvents.get(recordDate);
    if (eventRows && eventRows.length > 0) { await replaceDay(recordDate, eventRows); continue; }
    const bucketRows = byDayFromBuckets.get(recordDate);
    if (bucketRows && bucketRows.length > 0 && !(await hasAnyDataForDate(recordDate))) {
      await replaceDay(recordDate, bucketRows);
    }
```

#### 「昨日以前も遅延集計で変わりうる」は増加方向か、減少方向か

`lib/usage-sync.ts:21` のこのコメントは、**日次バケット（`INTERVAL_DAILY`）を一次ソースにしていた頃の記述**である。
現在の一次ソースはイベント積み上げで、バケットは「イベントが残っとらん日の埋め草」に降格している
（`lib/usage-sync.ts:23-30`）。埋め草経路は `!(await hasAnyDataForDate(recordDate))` で
**既存データがある日には適用されない**（上記 `:57`）ため、遅延集計による増加が既存行を押し上げる経路は無い。

**増加しうる唯一の条件**: `toRecordDate` / `dayRange` はいずれも端末のローカル時刻で暦日を切る
（`lib/dates.ts:8-13, 70-75`）。タイムゾーンや端末時計が変われば、同じ `record_date` ラベルが
指す絶対時間の窓がずれ、再計算値が前回より大きくなりうる。この場合 `savedMinutes` は後退する。

**確度**: 上書きが起きること・減る方向に動くことは**確定**（行番号で示せる）。
タイムゾーン変更時に増加すること自体はコードから言えるが、**実機での再現は未実施**。
確定させるには、端末のタイムゾーンを変更したうえで `syncLocalUsage` → `syncMeasuredDaily` を走らせ、
`measured_daily.actual_minutes` の変化を観測する必要がある。

### R1-3. `measured_vows` のカスケード削除の経路

**結論**: **アカウント削除以外に存在しない。**

**根拠**: R1-1 と同じく `.delete()` は 0件。アカウント削除は Edge Function 経由で `auth.users` を消し、
`on delete cascade`（`supabase/001_schema.sql:18, 70-71`）で `measured_vows` → `measured_daily` が連鎖する:

```
lib/account-deletion.ts:17
  const { error } = await supabase.functions.invoke('delete-account');
```

このとき端末側の高水位マークも明示的に消される（`lib/account-deletion.ts:30-33`）ので、
高水位が古いアカウントの値を持ち越すことはない。

なお `discontinued_on` を立てるコードも存在しない（前回報告 §4-1-1）ため、
「誓いをやめて `measured_saved` の行が減る」経路も現状は無い。
ただし `measured_saved` は `discontinued_on` で絞っていない（`003_graduation.sql:120-122`）ので、
仮に立ったとしても行は残り、`stoneCount` は減らない。

**確度**: 確定。

---

## 3. R2 — ビュー定義が変わる経路

### R2-1. 001 と 003 のビュー定義の差分

**結論**: **差分は `v.graduated_on` の 1 行追加のみ。集計式は完全に同一で、小さい値を返すことはない。**

**根拠**（`001_schema.sql:95-123` と `003_graduation.sql:105-135` の差分）:

```
11a12
>   v.graduated_on,          ← measured_saved に列が1本増えただけ
19c20
< -- 3-2. 庭の状態 …        ← 節番号のコメント差
---
> -- 4-2. 庭の状態 …
20a22
> --       001 からの変更なし(measured_saved を落とした巻き添えで作り直しとるだけ)
```

`saved_minutes` の式は両者で完全一致:

```sql
coalesce(sum(greatest(0, v.baseline_minutes - d.actual_minutes)), 0) as saved_minutes
```

`from measured_vows v left join measured_daily d on d.vow_id = v.id group by v.id` も同一で、
**どちらのバージョンにも vow の状態による where 句が無い**（`003_graduation.sql:88-92` の設計メモが明記）。
`garden_state` も `001:115-123` と `003:127-135` で完全一致（分母 210 を含む）。

**確度**: 確定（SQL ファイル上の定義として）。本番 Supabase に適用済みの定義は未確認。

### R2-2. 003 未適用の環境で `loadGrowth()` が走った場合

**結論**: **何も起きない（正常に動く）。** `loadGrowth` は `graduated_on` を参照しないため、003 未適用でも例外は出ない。

**根拠**:

```
components/garden/load.ts:56-57
    supabase.from('measured_saved').select('saved_minutes'),
    supabase.from('measured_daily').select('record_date'),
```

`measured_saved` は **001 の時点で既に存在する**ビューであり（`001_schema.sql:95-111`）、
`saved_minutes` 列も 001 に含まれる。003 で追加されたのは `graduated_on` だけなので、
このクエリは 001 のみ適用の環境でも成功する。

`lib/vows.ts:16-20` の `isMissingGraduatedOn` を使う耐性コードは
`declare.tsx` / `observe.tsx` / `settings.tsx` の3画面にあるが、**`load.ts` には無い。必要がないため**である。

一方、**001 そのものが未適用**（`measured_saved` ビューが存在しない）なら、PostgREST は
`42P01`（relation does not exist）を返し、`savedRes.data` は `null` になる。
これは R2 ではなく **R3 の経路**として後退する（`savedMinutes: 0` / `stoneCount: 0`）。

**確度**: 確定。

---

## 4. R3 — 取得失敗が「0」として扱われる経路（**唯一の実在経路**）

### R3-1 / R3-2. エラー時に空配列へ落ちるか

**結論**: **Yes。落ちる。エラーは検査すらされていない。** 指示書の推論はコードのとおり正しい。

**根拠**（`components/garden/load.ts:54-64` 全文）:

```ts
export async function loadGrowth(userId: string): Promise<GrowthParams> {
  const [savedRes, daysRes] = await Promise.all([
    supabase.from('measured_saved').select('saved_minutes'),
    supabase.from('measured_daily').select('record_date'),
  ]);
  const vows = savedRes.data ?? [];                                        // ← ここ
  const snapshot: GardenSnapshot = {
    stoneCount: vows.length,
    savedMinutes: vows.reduce((sum, v) => sum + Number(v.saved_minutes ?? 0), 0),
    recordedDays: new Set((daysRes.data ?? []).map((d) => d.record_date as string)).size,  // ← ここ
  };
```

- `savedRes.error` / `daysRes.error` を**一度も参照していない**。
- PostgREST がエラーを返したとき `data` は `null` になり、`?? []` で空配列に化ける。
- 結果として `stoneCount: 0` / `savedMinutes: 0` / `recordedDays: 0` の
  **完全にまっさらなスナップショット**が組まれる。

この扱いは、同じファイル内の他の失敗（AsyncStorage 読み取り）が明示的に握られているのとは対照的で、
**Supabase 側の失敗だけが無検査**である（`:67-72` は try/catch を持つ）。

比較のため — ホーム画面の誓い一覧は同じ事故を明示的に防いでいる:

```
app/(app)/(tabs)/index.tsx:158-162
    if (vowsRes.error) {
      // 誓いが引けんかった回は、前回表示した誓いをそのまま残す。ここで空配列に
      // 上書きすると、通信断やスキーマ不一致のたびに計測中の誓いが全部消えて
      // 「まだ何も宣言しとらん」初回モードに化ける(見た目のデータ消失)。
```

**`loadGrowth` にはこのガードが無く、代わりに `mergeHighWater` が同じ役割を果たしている。**

#### 後退の再現条件と、影響の大きさ

**再現条件**（いずれか1つで成立）:

1. 通信断（機内モード・圏外）での起動
2. リフレッシュトークン失効による認証切れ
3. RLS 拒否（`auth.uid()` が null になる状態）
4. `001_schema.sql` 未適用のプロジェクトを向いている（`42P01`）

**`mergeHighWater` が無い場合に起きること**（誓い3本・記録60日・取り戻し累計 90 時間のユーザーが機内モードで起動）:

| フィールド | 通常時 | 取得失敗時 | 庭への影響 |
|---|---|---|---|
| `stoneCount` | 3 | **0** | `stones: 0` |
| `recordedDays` | 60 | **0** | 敷石 `cobbleCount(0) = 0`（`lib/garden/scene.ts:313-314`）、`path: 0` |
| `savedMinutes` | 5400 | **0** | `moss: 0`（苔が消え、地面が土色に戻る） |
| `weeks` | 8 | **0** | 光の到達が床値 0.4 まで後退（`lib/garden/scene.ts:430-434`） |

さらに**庭そのものが描画されなくなる**。ホームは `stones > 0` を描画の条件にしているためである:

```
app/(app)/(tabs)/index.tsx:423-431
        {growth && growth.stones > 0 ? (
          <Pressable onPress={onGardenPress}>
            <HomeGarden growth={growth} height={gardenHeight} prevGrowth={prevGrowth} />
          </Pressable>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.headline}>{t.home.emptyHeadline}</Text>
          </View>
        )}
```

**つまり `mergeHighWater` が無ければ、機内モードで開いた瞬間にホームが「まだ何も宣言していない」画面に化ける。**
これが `mergeHighWater` の本来の役割である。前回報告に書いた「欠落日による後退」ではない。

差分演出はこの後退で暴走しない（`changedCategories` の比較はすべて `>` なので、
後退時は空配列になり演出は流れない。`lib/garden/diff.ts:17-25`）。ただしそれは
副次的な安全であって、`lib/garden/diff.ts:4` は「後退は起きない前提」と明記している。

**確度**: 確定。

### R3-3. `loadGrowth()` は例外を投げるのか、値を返すのか

**結論**: **PostgREST がエラー応答を返す場合は値を返す（後退する）。fetch 自体が例外を投げる場合の挙動は未確認。**

**根拠**:

- **値を返す経路**（RLS拒否・テーブル不在・認証切れなど、HTTP 応答が返るケース）:
  `savedRes.data === null` → `?? []` → 0 のスナップショットを返して正常終了する。**これが後退経路。**
- **例外を投げる経路**: `Promise.all`（`:55`）に `catch` は無く、`loadGrowth` 全体にも try/catch は無い。
  したがってクエリの promise が reject すれば `loadGrowth` は throw する。

呼び出し元の扱いは2通りに分かれる:

| 呼び出し元 | 扱い | throw したときの結果 |
|---|---|---|
| `app/(app)/(tabs)/index.tsx:150`（`Promise.all` 内、`loadAll` は `:264, 272, 279` で await されず、`:291` で await） | **catch 無し** | `setGrowth` に到達しないため `growth` は前回値のまま → **後退しない**。ただし未処理の rejection になり、`onRefresh`（`:289-294`）経由なら `refreshing` が true のまま残る |
| `app/(app)/settings.tsx:66` | `.catch(() => null)` | 診断情報の `recordedDays` が 0 として送られる（`:71`） |

**皮肉な結果として、例外で落ちたほうが庭は守られる**（前回値が残るため）。
後退が起きるのは「エラーが値として返ってきたとき」だけである。

`@supabase/supabase-js` がネットワーク障害時に reject するか `{ data: null, error }` で resolve するかは、
**このリポジトリからは確定できない**（`node_modules` 未インストール。依存は `apps/yaranai-measured/package.json:16` の `^2.105.1`）。
確定させるには当該バージョンの `PostgrestBuilder.then` の実装（fetch の catch がエラー応答へ変換しているか）を読む必要がある。

**確度**: PostgREST エラー応答時の挙動は**確定**。ネットワーク層の例外の扱いは**未確認**。

### R3-4. PostgREST の行数上限による打ち切り

**結論**: **仮に打ち切られても、庭の見た目は後退しない。** `deriveGrowth` が 84 日でクランプするため。
ただし診断情報に出る**生の `recordedDays` は縮みうる**。

**根拠**:

**(a) `.limit()` / `.range()` の指定は無い**:

```
$ grep -rn "\.limit(\|\.range(" --include="*.ts" --include="*.tsx" apps/yaranai-measured
apps/yaranai-measured/lib/articles/evaluate.ts:66:      .limit(1);
```

`load.ts` の 2 クエリには指定が無い。クライアント側の設定も無い（`packages/core/src/supabase.ts:77-86` は `auth` のみ）。

**(b) 影響を受けるのは `daysRes` のみ**:
`measured_saved` は 1 誓い 1 行（`group by v.id`）なので最大でも数行。上限に届かない。
`measured_daily` は「誓い本数 × 記録日数」で伸び続ける。誓い3本を1年継続すると約 1,095 行になる。

**(c) それでも庭は後退しない**:

```
lib/garden/growth.ts:49-57
  const days = Math.max(0, Math.floor(s.recordedDays));
  const weeks = Math.min(FULL_WEEKS, Math.floor(days / 7));
  return {
    ...
    path: clamp01(days / FULL_DAYS),        // FULL_DAYS = 84
    weeks,                                   // 上限 12
```

`recordedDays` を消費する3箇所すべてが 84 日で頭打ちになる:
`path`（`:54`）、`weeks`（`:50`）、`cobbleCount`（`lib/garden/scene.ts:312-317`、35枚で上限）、
`postPairCount`（`lib/garden/scene.ts:334-336`、`clamp01(days/84)`）。

仮に 1,000 行で打ち切られても、誓い3本なら約 333 の distinct `record_date` が返る。
84 を大きく上回るため、`path` / `weeks` / 敷石はすべて満了のまま変わらない。

**(d) 唯一の可視面**: お問い合わせの診断情報に出る生値。

```
app/(app)/settings.tsx:71     recordedDays: growth?.recordedDays ?? 0,
lib/i18n/strings.ts:535       `記録日数: ${d.recordedDays}日`,
```

ここだけは 84 を超えた実数を出すため、打ち切りが起きれば表示値が縮む。

**確度**: (a)〜(d) は**確定**。ただし**上限が実際に何行で効くかは未確認**。
PostgREST の `db-max-rows` はサーバー側設定であり、このリポジトリには現れない。
確定させるには Supabase ダッシュボードの API 設定（`db.max-rows` / Max Rows）を確認するか、
`measured_daily` を 1,000 行超に育てて返却行数を数える必要がある。

---

## 5. R4 — `mergeHighWater` 自体の挙動

### R4-1. 実装（全文）

**結論**: **3フィールドを個別に `Math.max` している。** スナップショット単位の比較ではない。

```
lib/garden/growth.ts:61-74
// 単調非減少ガード(非交渉ライン4)。
// データ側の事故(誓いの削除・再同期での行消失など)があっても、
// 一度見せた蓄積より庭が後退しないよう高水位マークと合成する。
export function mergeHighWater(
  prev: GardenSnapshot | null,
  next: GardenSnapshot,
): GardenSnapshot {
  if (!prev) return next;
  return {
    stoneCount: Math.max(prev.stoneCount, next.stoneCount),
    recordedDays: Math.max(prev.recordedDays, next.recordedDays),
    savedMinutes: Math.max(prev.savedMinutes, next.savedMinutes),
  };
}
```

フィールドごとに独立なので、「石だけ取れて日数が取れなかった」ような部分失敗でも、
取れたフィールドだけが更新される。

なお `:62-63` のコメントが挙げる想定理由（「誓いの削除・再同期での行消失」）は、
本調査の結果と食い違う。**削除経路も行消失経路も存在しない**（R1）。
実際に守っているのは R3 の取得失敗である（§6-1 に記録）。

**確度**: 確定。

### R4-2. 高水位が書き込まれるタイミング / 失敗時に 0 で上書きされるか

**結論**: **書き込みは取得の成否に関わらず毎回走る。しかし 0 で上書きされることはない**（書くのは合成後の値であるため）。

**根拠**:

```
components/garden/load.ts:73-75
  const merged = mergeHighWater(prev, snapshot);
  AsyncStorage.setItem(keyFor(userId), JSON.stringify(merged)).catch(() => {});
  return deriveGrowth(merged);
```

`:74` は `snapshot`（生の取得結果）ではなく `merged`（`Math.max` 済み）を書く。
取得が失敗して `snapshot` が全 0 でも、`merged` は `prev` と同値になるため、高水位は減らない。

**唯一 0 が書かれるケース**: `prev` が `null`（初回、またはアカウント削除後）かつ取得失敗のとき、
`mergeHighWater` は `next`（= 全 0）をそのまま返す（`lib/garden/growth.ts:68`）。
ただしこの場合は失われる高水位が存在しないため、事故にはならない。

**副作用として注意すべき点**: `loadGrowth` は読み取り関数の名前をしているが、
**呼ぶたびに AsyncStorage へ書き込む**。したがって `app/(app)/settings.tsx:66`（お問い合わせ画面を開いただけ）でも
高水位が更新される。値としては安全（`Math.max`）だが、副作用の場所としては予想しにくい（§6-2 に記録）。

**確度**: 確定。

### R4-3. サーバーが後から追いついたときに正しく合流するか

**結論**: **合流する。** `Math.max` なので、サーバー値が高水位を超えた時点でサーバー値が採用される。

**根拠**: `lib/garden/growth.ts:70-72` の3行がいずれも `Math.max(prev, next)`。
`next`（サーバー値）が `prev`（高水位）を上回れば `next` が返り、その値が `:74` で高水位として書き戻される。
高水位が恒久的に天井として残ることはない。

**ただし1点、合流が起きない状況がある**: サーバー値が高水位より**恒久的に小さいまま**の場合
（例: 前回報告 Q4-2 の欠落日で `measured_daily` に穴があり、`recordedDays` がサーバー上で
永久に高水位へ届かない場合）、高水位が実質的な表示値として残り続ける。
このとき庭は後退しないが、**サーバーだけを見て復元しても同じ庭にはならない**。
これは復元フローの設計にそのまま効く事実である。

**確度**: 確定。

---

## 6. 前回調査の訂正

### 訂正1（本題）

**前回の記述**（`restore-flow-investigation-report.md` Q6 / `restore-flow-data-inventory.md` #12）:

> 「サーバー側に欠落日がある場合に庭が後退して見える」

**本調査の結果**: **この記述は誤り。** 欠落日は後退の原因ではない。

理由:
- 欠落日（前回 Q4-2）は「サーバーの値が実態より小さいまま伸びない」状態であって、
  **既に記録された値が減る**わけではない。`measured_daily` に削除経路は無く（R1-1）、
  `measured_saved` の集計式も単調（R2-1）。
- 高水位マークが失われても、欠落日を理由に値が下がることはない。
  高水位を失った端末は「サーバーの実値（欠落を含む、やや小さい値）から再開する」だけである。
  これは**後退ではなく、それまで高水位が上乗せしていた分の消失**である。

**正しい記述**: 高水位マークが守っているのは、**取得失敗（通信断・認証切れ・RLS拒否・スキーマ未適用）のときに
`data ?? []` が 0 を作る経路**（R3）である。
欠落日との関係は、R4-3 に書いたとおり「サーバー値が高水位に永久に届かない場合、
高水位が実質の表示値として残り続ける」という別の形で現れる。

前回の該当2ファイルは本コミットで訂正済み。

### 訂正2（軽微）

前回報告 §4-2-4 の

> 「端末の高水位マークが旧端末でこの欠落を覆い隠していた場合、新端末ではサーバーの実値まで庭が後退する」

も、厳密には「後退」ではなく「高水位の上乗せ分の消失」である。
機種変更の文脈では利用者から見て同じ現象（庭が若返る）だが、原因が違う。
前回ファイルでは表現を改めた。

---

## 7. 調査中に見つけた事項（直していない。報告のみ）

1. **`loadGrowth` が Supabase のエラーを一度も検査していない。**
   `components/garden/load.ts:55-64`。同一プロジェクト内の `app/(app)/(tabs)/index.tsx:158-162` は
   同じ事故を明示的に防いでおり（「空配列に上書きすると…見た目のデータ消失」）、扱いが揃っていない。

2. **`mergeHighWater` の doc コメントが、実際に守っている経路と食い違っている。**
   `lib/garden/growth.ts:62-63` は「誓いの削除・再同期での行消失など」を理由に挙げるが、
   削除経路（R1-1・R1-3）も行消失経路（R1-2）も存在しない。実際に守っているのは R3 の取得失敗である。

3. **`loadGrowth` は名前に反して AsyncStorage へ書き込む。**
   `components/garden/load.ts:74`。お問い合わせ画面を開くだけで高水位が更新される
   （`app/(app)/settings.tsx:66`）。値としては安全だが、副作用の位置が名前から読めない。

4. **`lib/usage-sync.ts:21` のコメントが現在の一次ソースと合っていない。**
   「昨日以前も遅延集計で変わりうるけん、毎回洗い替える」は日次バケットを一次ソースにしていた頃の記述。
   現在の一次ソースはイベント積み上げで、同ファイル `:23-30` が「バケットは埋め草」と降格を宣言している。
   R1-2 の判定でこのコメントを根拠にすると読み違える。

5. **`lib/garden/diff.ts:4` が「後退は起きない前提」と明記している。**
   実際には R3 で後退しうる（高水位が無ければ）。現状は比較演算子がすべて `>` のため
   後退時は演出が流れないだけで済んでいるが、前提が成立していないことは記録に値する。

6. **`onRefresh` が例外を握らない。**
   `app/(app)/(tabs)/index.tsx:289-294`。`loadAll()` が throw すると `setRefreshing(false)` に到達せず、
   引っぱって更新のインジケータが回りっぱなしになる。

7. **`loadAll()` が3箇所で await も catch もされずに呼ばれている。**
   `app/(app)/(tabs)/index.tsx:264, 272, 279`。throw した場合は未処理の rejection になる。

---

## 8. この調査で答えを出していないもの

指示書 §3 のとおり、以下は扱っていない（改善提案も書いていない）。

- 高水位マークをサーバーに保存すべきかどうか
- 欠落日の扱いを変えるべきかどうか
- 上記の修正方針・実装案
