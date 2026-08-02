// 卒業判定の「材料集め」層。窓の取り方と端末内DBの読み出しをここに一本化する。
//
// 分けとる理由: 以前はホーム(導線を出す)・graduate(実行直前の再評価)が
// それぞれ窓とクエリを組み立てとった。同じ判定を3箇所で書くと、片方だけ窓が
// ずれても誰も気づけん。実際「時間の行き先」は卒業判定を通さず、DBに行がある
// (=1msでも前景があった)だけで誓いのアプリを並べ続けとって、
// 「一覧から消えた = 卒業できる」の対応が成り立っとらんかった。
//
// 判定そのものは lib/graduation.ts の純関数(node:test でテスト済み)。
// ここは窓とDBを与えるだけで、条件の意味には手を出さない。

import { graduationWindowDates, graduationWindowStart } from './dates';
import { getPackageForegroundMsByDateSince, getRecordedDatesSince } from './usage-db';
import { computeGraduationEligibility } from './graduation';

/**
 * 渡したパッケージのうち、卒業条件(前日までの7暦日、一度も使っていない)を
 * 満たすものだけを返す。判定してよいのは挑戦中の誓いだけやけん、
 * 卒業済み・廃止は呼び出し側で外しておくこと。
 *
 * 観測日の集合(欠損ガード)は窓ぶんを1回だけ引いて全パッケージで使い回す。
 */
export async function findGraduablePackages(
  packageNames: readonly string[],
): Promise<Set<string>> {
  const graduable = new Set<string>();
  if (packageNames.length === 0) return graduable;

  const since = graduationWindowStart();
  const windowDates = graduationWindowDates();
  const recordedDates = await getRecordedDatesSince(since);

  for (const packageName of packageNames) {
    const foregroundMsByDate = await getPackageForegroundMsByDateSince(packageName, since);
    if (computeGraduationEligibility({ windowDates, recordedDates, foregroundMsByDate })) {
      graduable.add(packageName);
    }
  }
  return graduable;
}

/** 1パッケージぶん。graduate.tsx の実行直前の再評価が使う。 */
export async function isGraduable(packageName: string): Promise<boolean> {
  return (await findGraduablePackages([packageName])).has(packageName);
}
