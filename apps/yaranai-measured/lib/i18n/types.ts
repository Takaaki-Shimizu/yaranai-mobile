// 表示言語の型。純粋な型だけを置き、React や AsyncStorage に依存しない。
// (lib/format.ts や lib/garden/diff.ts など node:test で回す純関数からも import するため)

export type Lang = 'ja' | 'en';

export const DEFAULT_LANG: Lang = 'ja';
