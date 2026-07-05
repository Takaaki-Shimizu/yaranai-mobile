export type CheckInState = "kept" | "broke" | null;

export type Vow = {
  id: string;
  label: string;
  streak: number;
  kept: number;
  total: number;
  best: number;
  focus: boolean;
  minutesPerDay: number;
  savedHours: number;
  todayDone: CheckInState;
  startedLabel: string;
  note: string;
  linkedGoal?: string;
  recent: number[];
};

export type Goal = {
  id: string;
  label: string;
  deadline: string;
  savedHours: number;
  referenceLabel: string;
  referenceHours: number;
  linkedVows: string[];
  linkedVowsDays: number[];
  why: string;
};

export type CommunityPulseItem = {
  count: number;
  label: string;
  note: string;
};

export type YaranaiData = {
  vows: Vow[];
  todayPending: { id: string; label: string; streak: number };
  communityPulse: CommunityPulseItem[];
  goals: Goal[];
  candidateGoal: { id: string; label: string; deadline: string };
};

const recentMostlyKept = (markBreak: number[], len = 42): number[] =>
  Array.from({ length: len }, (_, i) =>
    markBreak.includes(i) ? 0 : i === len - 1 ? 2 : 1
  );

const recentMostlyOff = (lastKept: number, len = 42): number[] =>
  Array.from({ length: len }, (_, i) =>
    i === len - 1 ? 2 : i >= len - 1 - lastKept ? 1 : 0
  );

export const yaranaiData: YaranaiData = {
  vows: [
    {
      id: "v1",
      label: "朝のSNSチェック",
      streak: 23,
      kept: 23,
      total: 25,
      best: 31,
      focus: true,
      minutesPerDay: 30,
      savedHours: 11.5,
      todayDone: null,
      startedLabel: "4月10日",
      note: "目が覚めて30分以内、スマホを開かない。\n自分の声を、外の声より先に聞く。",
      linkedGoal: "フルマラソンを完走する",
      recent: [
        1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1,
      ],
    },
    {
      id: "v2",
      label: "気乗りしない飲み会",
      streak: 7,
      kept: 7,
      total: 8,
      best: 12,
      focus: true,
      minutesPerDay: 180,
      savedHours: 21,
      todayDone: null,
      startedLabel: "4月25日",
      note: "誘いに、その場で答えない。\n一晩おいて、行きたい時だけ行く。",
      linkedGoal: "フルマラソンを完走する",
      recent: recentMostlyOff(7),
    },
    {
      id: "v3",
      label: "寝る前のショート動画",
      streak: 92,
      kept: 88,
      total: 92,
      best: 92,
      focus: true,
      minutesPerDay: 45,
      savedHours: 69,
      todayDone: null,
      startedLabel: "2月1日",
      note: "布団に入ってから、画面を開かない。\n眠るための、暗い時間を取り戻す。",
      linkedGoal: "本を 月2冊 読む",
      recent: recentMostlyKept([13, 27]),
    },
    {
      id: "v4",
      label: "コンビニの寄り道",
      streak: 4,
      kept: 4,
      total: 5,
      best: 9,
      focus: false,
      minutesPerDay: 10,
      savedHours: 0.7,
      todayDone: null,
      startedLabel: "4月29日",
      note: "なんとなく、で買わない。",
      recent: recentMostlyOff(5),
    },
    {
      id: "v5",
      label: "愚痴の聞き役",
      streak: 18,
      kept: 17,
      total: 18,
      best: 22,
      focus: false,
      minutesPerDay: 60,
      savedHours: 18,
      todayDone: null,
      startedLabel: "4月15日",
      note: "誰かの愚痴を、ただ受け取らない。",
      recent: recentMostlyKept([22]),
    },
    {
      id: "v6",
      label: "なんとなくのサブスク",
      streak: 31,
      kept: 31,
      total: 31,
      best: 31,
      focus: false,
      minutesPerDay: 5,
      savedHours: 2.6,
      todayDone: null,
      startedLabel: "4月2日",
      note: "請求が来てから「これ何だっけ」と思うものを、置かない。",
      recent: recentMostlyKept([]),
    },
  ],
  todayPending: {
    id: "v1",
    label: "朝のSNSチェック",
    streak: 23,
  },
  communityPulse: [
    { count: 238, label: "寝る前のSNS", note: "いま、いっしょに 静かにしてる" },
    { count: 84, label: "気乗りしない飲み会", note: "きょう、ことわった人" },
    { count: 31, label: "愚痴の聞き役", note: "今週、距離をとった人" },
  ],
  goals: [
    {
      id: "g1",
      label: "フルマラソンを 完走できる 体に なっている",
      deadline: "2026 / 11 / 03",
      savedHours: 312,
      referenceLabel: "フルマラソン練習に必要と される 600時間",
      referenceHours: 600,
      linkedVows: ["夜ふかし", "気乗りしない飲み会"],
      linkedVowsDays: [23, 7],
      why: "走り終えた朝、コーヒーを飲みながら「やりきった」と言える自分でいたい。\n42キロを走る体は、毎日の小さな選択の積み重ねでしかつくれない。",
    },
    {
      id: "g2",
      label: "本に 戻れる 自分で いる",
      deadline: "2025 / 12 / 31",
      savedHours: 184,
      referenceLabel: "長編小説 12冊分の 読書時間",
      referenceHours: 144,
      linkedVows: ["寝る前のSNS", "ショート動画"],
      linkedVowsDays: [238, 14],
      why: "言葉のシャワーから、言葉の対話へ戻る。",
    },
    {
      id: "g3",
      label: "家族と 夕飯を 共にしている 日々で ある",
      deadline: "2026 / 春",
      savedHours: 96,
      referenceLabel: "夕飯を 50回 一緒に過ごせる 時間",
      referenceHours: 100,
      linkedVows: ["平日の残業"],
      linkedVowsDays: [42],
      why: "積み重なるのは、特別な日ではなく、ふつうの夕飯のほう。",
    },
  ],
  candidateGoal: {
    id: "g4",
    label: "英語で 会議を 回せる 自分に なっている",
    deadline: "2026 / 06",
  },
};
