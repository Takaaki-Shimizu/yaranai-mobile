// 庭のデザイントークン(§3.2)。
// 大気・地面・光・粒子・竹の色は mock v4(yaranai-crop-mock-v4)の「晴れた朝、靄が残る」
// 暖色仕様(§変更3)。苔・敷石・石の階調は north-star v3 の描画品質を保つため据え置き。
// 変更するときは両モックと突き合わせること。

export const GARDEN_COLORS = {
  // 生成り系(UI 背景)
  kinari: '#F2EDE1',

  // 空(暖色グラデ。mock v4 skyG)
  skyTop: '#EDE5CF',
  skyMid: '#E3DBC3',
  skyBottom: '#DAD1B6',

  // 朝靄(暖色。mock v4 mistG。無彩色グレーは廃止。§変更3)
  mist: '#E9E1C9',
  // 地平線直下に落ちる靄の帯
  mistFloor: '#E2D8B8',

  // 地面のベース色。苔の充実 m で 土色(m=0)→中間の緑(Day42)→完成の緑(Day84)へ補間。
  // 初期〜中期は暖色の土で画面を暗くしない(§変更3)。Day84 は苔が地面全体を覆う(north-star)。
  ground: ['#D9CDAB', '#D0C29D', '#C6B78F'] as const, // m=0(土)。mock v4 groundG
  fieldMid: ['#AEB980', '#8F9C66', '#71804F'] as const, // Day42
  fieldFull: ['#93A76B', '#71854D', '#54663C'] as const, // Day84(north-star gField)

  // 墨・石(north-star v3 の階調を維持)
  sumi: '#2E2B26',
  stoneDark: '#181612',
  stoneLight: '#5A5448',
  stoneHighlight: '#7A7261',
  shadowInk: '#1F1D19',

  // 敷石3階調 + 目地(north-star v3)
  cobbleA: ['#B3AB97', '#948C79', '#6B6454'],
  cobbleB: ['#A8A69A', '#87857A', '#5F5D52'],
  cobbleC: ['#9A9078', '#7C725C', '#564F40'],
  jointTop: '#8A8271',
  jointBottom: '#6E6656',

  // 苔(3系統×3階調。north-star v3)
  mossLight: ['#BCCB86', '#8CA05F', '#5F7340'],
  mossMid: ['#A0B76F', '#6E824A', '#46572F'],
  mossDeep: ['#84995A', '#54673A', '#313E23'],
  mossGrainLight: '#C6D48F',
  mossGrainDark: '#3A4A28',
  mossSkirt: '#46572F',
  mossPatch: '#8CA05F',

  // 竹の連続深度(§変更4)。稈のグラデ 3 ストップを靄色へ深度で混色する。
  // 全稈が t(0=最前〜1=最奥)を持ち、色は cg0..cg5 のバケツで生成する。
  culmStops: ['#3E6339', '#5E8C50', '#7FAE68'] as const,
  culmMist: '#D9D2BA', // 竹が溶け込む靄色(大気の mist とは別)
  nodeBase: '#2F4A2C', // 節: mix(nodeBase, culmMist, t*0.8)
  culmHighlight: '#A9CC8E', // 右側の明帯
  culmEdge: '#2C4A2C', // 最前列の左の陰

  // 梢・葉(位置は mock v4 canopyBlobs、色は north-star v3 のやわらかい階調)
  canopyDark: '#4E6A3C',
  canopyMid: '#557247',
  canopyLight: '#5C7643',
  canopyUnder: '#6E8557', // 下層の梢
  canopyUnderLight: '#6E8557',
  canopyHaze: '#6E8C56', // 梢のぼかし縁
  leafA: '#6F8657',
  leafB: '#7E9468',

  // 木漏れ日(暖色。§変更3)
  lightPool: '#F6ECC8', // 地面の光だまり(poolG 中心色)
  lightShaft: '#F7EDC8', // 右上からの光条(rayG)
  trunkShadow: '#544F3E', // 竹の長い落ち影(op 0.06 で使う)

  // 朱(Day 84 のひとひらのみ)
  shu: '#B0472F',

  // 乾いた土の名残(Day 1 の地肌テクスチャ)。暖色の地面に馴染む粒
  dryGrain: '#C7B78F',
  dryPatch: '#DCD2B2',

  // 蹲踞の水(§変更2 の翼。mock v4 waterG)
  water: ['#77816F', '#525C50'] as const,
  waterHighlight: '#8E968A',
  ladle: '#8A7F66', // 柄杓
  ladleKnob: '#75694F',

  // 結界(杭と縄。mock v4 は #3A352D)
  post: '#3A352D',
  rope: '#3A352D',
} as const;

// 揺らぎ(feTurbulence + feDisplacementMap 相当)のパラメータ(§3.3)。据え置き
export const WOBBLE_PARAMS = {
  strong: { baseFrequency: 0.012, octaves: 3, seed: 7, scale: 16 },
  soft: { baseFrequency: 0.02, octaves: 2, seed: 11, scale: 8 },
  cobble: { baseFrequency: 0.05, octaves: 2, seed: 4, scale: 6 },
} as const;

// 紙の粒子(全面ノイズ)。§変更3: 現行より弱く、暖色寄りのカラーマトリクス(mock v4 grainF)。
// RGB を暖色の砂色(.21/.19/.15)に固定し、アルファを輝度から作る。
// opacity は 0.10 だと実機のパネルサイズで淡い空・土の上に暗い斑点が乗って画面がくすむため、
// 質感は残しつつ 0.06 まで下げて全面を持ち上げる(初期段階=土色の地面で最も効く)。
export const GRAIN = { baseFrequency: 0.9, octaves: 2, opacity: 0.06 } as const;
export const GRAIN_RGB = [0.21, 0.19, 0.15] as const;
