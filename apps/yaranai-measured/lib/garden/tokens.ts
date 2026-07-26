// 庭のデザイントークン(§3.2)。
// 大気・地面・光・粒子・竹の色は mock v4(yaranai-crop-mock-v4)の「晴れた朝、靄が残る」
// 暖色仕様(§変更3)を「厳か」調整で上書き: 印象が「暗い」に傾く原因は輝度ではなく
// 低コントラスト・低彩度・光の無方向性なので、苔と地面は彩度を、石は最暗部を持ち上げ、
// 明暗の落差は光(木漏れ日)と影に担わせる。西芳寺の「深い影の中で苔だけが光る」が基準。
// 変更するときはモックと SVG プレビュー(scripts/render-garden-previews.js)+実機で突き合わせること。

export const GARDEN_COLORS = {
  // 生成り系(UI 背景)
  kinari: '#F2EDE1',

  // 空(暖色グラデ。mock v4 skyG)
  skyTop: '#EDE5CF',
  skyMid: '#E3DBC3',
  skyBottom: '#DAD1B6',

  // 朝靄(暖色。mock v4 mistG。無彩色グレーは廃止。§変更3)
  mist: '#F0E9D3',
  // 地平線直下に落ちる靄の帯
  mistFloor: '#E8DFC2',

  // 地面のベース色。苔の充実 m で 土色(m=0)→中間の緑(Day42)→完成の緑(Day84)へ補間。
  // 初期〜中期は暖色の土で画面を暗くしない(§変更3)。Day84 は苔が地面全体を覆う(north-star)。
  ground: ['#DDD1AC', '#D4C69E', '#CABA8F'] as const, // m=0(土)。mock v4 groundG
  fieldMid: ['#B2C17C', '#93A464', '#75884E'] as const, // Day42
  fieldFull: ['#9BB56C', '#79924E', '#5A713E'] as const, // Day84(north-star gField)

  // 墨・石(north-star v3 の階調を維持)
  sumi: '#38342C',
  stoneDark: '#262219',
  stoneLight: '#6A6350',
  stoneHighlight: '#8C8471',
  shadowInk: '#1F1D19',

  // 敷石3階調(north-star v3)。これは基準色で、実際の一枚ごとの色は
  // scene.ts が明度と色味を決定論的に振って作る(cobbleTintWarm/Cool)
  cobbleA: ['#B3AB97', '#948C79', '#6B6454'],
  cobbleB: ['#A8A69A', '#87857A', '#5F5D52'],
  cobbleC: ['#9A9078', '#7C725C', '#564F40'],
  // 敷石の個体差。石ごとの色味を暖/寒どちらかへ寄せる先(西芳寺の敷石は
  // 赤茶の石と青灰の石が隣り合っていて、その差が「本物の石」を作る)
  cobbleTintWarm: '#8A7452',
  cobbleTintCool: '#6F757C',
  // 目地は石より確実に暗いこと。石と同明度(north-star の #8A8271)だと一枚ずつの
  // 輪郭が消えて参道が一枚の面に潰れる。ただし敷石は路面を覆いきらないので、
  // 闇まで落とすと今度は参道が黒い川になる。石の間に踏み固められた土、の暗さに置く
  jointTop: '#7B7261',
  jointBottom: '#5C5445',
  // 敷石の接地影。石は苔と土の面に「沈んでいる」ように見せる
  cobbleShadow: '#211E17',

  // 苔(3系統×3階調。north-star v3)
  mossLight: ['#CCDC8E', '#9CB964', '#6C8A45'],
  mossMid: ['#ACC475', '#7C9A4C', '#4F6B33'],
  mossDeep: ['#8FAA5E', '#5C7A3E', '#375329'],
  mossGrainLight: '#D8E69C',
  mossGrainDark: '#3A4A28',
  mossSkirt: '#4F6B33',
  mossPatch: '#9CB964',

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
  lightPool: '#FAF2CC', // 地面の光だまり(poolG 中心色)
  lightShaft: '#FAF1CA', // 右上からの光条(rayG)
  mossSunGlow: '#F2EFA8', // 日なた苔: 光だまりに重なる苔を輝かせる黄緑の光
  trunkShadow: '#544F3E', // 竹の長い落ち影(scene の TRUNK_SHADOWS が op 0.20〜0.24 で使う)

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
// 粒は暗色側にしか働かず、強いと全面が一様にくすんで曇天の印象になる。
// 木漏れ日を主役にする「厳か」調整では質感が判る下限の 0.035 まで下げる(0.10→0.06→0.035)。
export const GRAIN = { baseFrequency: 0.9, octaves: 2, opacity: 0.035 } as const;
export const GRAIN_RGB = [0.21, 0.19, 0.15] as const;
