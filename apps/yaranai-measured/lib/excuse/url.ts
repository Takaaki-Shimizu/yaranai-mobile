// カードのQRが指す先(指示書 §2-7)。
//
// 遷移先はLPトップ直。カード専用の着地ページは作らない ── 受け手の「Yaranaiとは」には
// LPトップが既に答えており、流入の分離はUTMで足りるため。
// カード経由の流入実績が出たあとの専用ページ化は、成長設計の検討事項として残す。

export const EXCUSE_CARD_UTM_SOURCE = 'excuse_card';

export const EXCUSE_CARD_URL = `https://yaranai.app/?utm_source=${EXCUSE_CARD_UTM_SOURCE}`;
