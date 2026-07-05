import { Platform } from 'react-native';

// 侘び寂びパレット (LPと同一)
export const colors = {
  kinari: '#F1EBDE',   // 生成り(地)
  sumi: '#2B2723',     // 墨(文字)
  usuzumi: '#8C8577',  // 薄墨(補助)
  shu: '#B9482F',      // 朱(NG・行動)
  koke: '#6E7359',     // 苔
  suna: '#E4DCCB',     // 砂(区切り・地2)
  keptBg: '#EFE0AE',   // やらない(スプレッドシートの黄)
};

// 明朝体。カスタムフォント(しっぽり明朝)導入は7/7以降でよか。
export const fonts = {
  serif: Platform.select({ ios: 'Hiragino Mincho ProN', android: 'serif', default: 'serif' }),
};
