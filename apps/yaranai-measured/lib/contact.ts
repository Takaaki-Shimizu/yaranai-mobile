// お問い合わせ導線(設定+お問い合わせ スペック §4)。
//
// フォームは作らない。mailto: で端末の既定メールアプリを開くだけにする。
// 問い合わせ内容がどのサーバーにも保存されず(ローカルファースト思想と整合)、
// 診断情報を本文にプリフィルしても、それがユーザーの目に見えて編集もできる ──
// 「裏で何かを送っていない」ことが構造的に保証される。
//
// このファイルは純関数のみ(React Native に依存しない)。node:test で回すため。

export const CONTACT_EMAIL = 'support@yaranai.app';

// 本文に添える診断情報(§4.3)。復元・削除の問い合わせで本人特定ができんと
// 対応不能になるため ID は全体を入れる。ただし本文に平文で見えており、
// ユーザーが消して送ることもできる(「消せる」ことが重要)。
export type ContactDiagnostics = {
  version: string;
  build: string;
  androidVersion: string;
  deviceModel: string;
  /**
   * 記録日数。null = 取得できなかった(通信断など)。
   * ここを 0 に丸めてはならん ── 復元や記録の欠落の相談で届く本文やけん、
   * 「引けんかった」と「本当に0日」を取り違えると調査そのものが逆方向へ行く。
   */
  recordedDays: number | null;
  vowCount: number;
  userId: string;
};

// encodeURIComponent は必須(§4.2)。日本語と改行が含まれるため、
// エンコードなしでは Android の一部メールアプリで本文が欠落する。
export function buildMailtoUrl(email: string, subject: string, body: string): string {
  return (
    `mailto:${email}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}
