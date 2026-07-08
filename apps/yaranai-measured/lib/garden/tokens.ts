// 庭のデザイントークン(§3.2)。値は docs/mocks/ の SVG defs から抽出したもの。
// 変更するときはモックと突き合わせること。

export const GARDEN_COLORS = {
  // 生成り系
  kinari: '#F2EDE1',
  skyTop: '#EDE9D0',
  skyBottom: '#EAE4CC',
  skyTopDry: '#EFECDB', // Day 1
  skyBottomDry: '#ECE6D3',
  mist: '#F3F1E2',

  // 墨・石
  sumi: '#2E2B26',
  stoneDark: '#181612',
  stoneLight: '#5A5448',
  stoneHighlight: '#7A7261',
  shadowInk: '#1F1D19',

  // 敷石3階調 + 目地
  cobbleA: ['#B3AB97', '#948C79', '#6B6454'],
  cobbleB: ['#A8A69A', '#87857A', '#5F5D52'],
  cobbleC: ['#9A9078', '#7C725C', '#564F40'],
  jointTop: '#8A8271',
  jointBottom: '#6E6656',

  // 苔(3系統×3階調)
  mossLight: ['#BCCB86', '#8CA05F', '#5F7340'],
  mossMid: ['#A0B76F', '#6E824A', '#46572F'],
  mossDeep: ['#84995A', '#54673A', '#313E23'],
  mossGrainLight: '#C6D48F',
  mossGrainDark: '#3A4A28',
  mossSkirt: '#46572F',
  mossPatch: '#8CA05F',

  // 竹
  culmNear: ['#8FA765', '#62804A', '#40552F'],
  culmMid: ['#9DB07C', '#6E8557'],
  culmFar: '#A3B183',
  nodeNear: '#334524',
  nodeMid: '#4E6438',
  canopyDark: '#4E6A3C',
  canopyLight: '#5C7643',
  canopyMid: '#6E8557',

  // 木漏れ日
  lightPool: '#E6EEA6',
  lightPoolSoft: '#DCE79C',
  lightPoolWarm: '#F0ECC2',
  lightShaft: '#FFF8DF',
  trunkShadow: '#2C3A20',
  branchShadow: '#3A3428',

  // 朱(Day 84 のひとひらのみ)
  shu: '#B0472F',

  // 乾いた地(Day 1)
  fieldDry: ['#E2D7BA', '#D3C5A3', '#C2B28D'],
  fieldMid: ['#AEB980', '#8F9C66', '#71804F'], // Day 42
  fieldFull: ['#93A76B', '#71854D', '#54663C'], // Day 84
  dryGrain: '#B4A582',
  dryPatch: '#D8CCA9',

  // 杭と縄
  post: '#4A3B2C',
  rope: '#5C4A36',
} as const;

// 揺らぎ(feTurbulence + feDisplacementMap 相当)のパラメータ(§3.3)
export const WOBBLE_PARAMS = {
  strong: { baseFrequency: 0.012, octaves: 3, seed: 7, scale: 16 },
  soft: { baseFrequency: 0.02, octaves: 2, seed: 11, scale: 8 },
  cobble: { baseFrequency: 0.05, octaves: 2, seed: 4, scale: 6 },
} as const;

// 紙の粒子(全面ノイズ)。モック原値は 0.12 だが、実機のパネルサイズだと
// 淡い空・大地の上でノイズが目立ってくすみ、初見で「画面が暗い」と映る。
// 全面に効く黒ノイズなので控えめ(0.06)にして、質感は残しつつ地色を持ち上げる。
export const GRAIN = { baseFrequency: 0.9, octaves: 2, opacity: 0.06 } as const;
