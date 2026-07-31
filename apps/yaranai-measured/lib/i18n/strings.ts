// 画面文言の辞書。UIに出る文字列はすべてここを通す(開発者モード専用UIとログは除く)。
//
// 英語の文体方針:
//   - 日本語の「静かな断定・読点の呼吸・数字を誇らない」を英語でも保つ。
//   - 直訳ではなく、英語話者が読んで違和感のない自然な言い回しを優先する。
//   - スラングは使わない。この世界観(枯山水・明朝・余白)では砕けた語彙が浮くため、
//     口語の柔らかさは語順とリズムで出す。
//
// 挿し込み値(日数・時間など)は関数で受ける。改行(\n)は画面の行組みに合わせて
// 言語ごとに調整してあるので、機械的に揃えないこと。

import type { Lang } from './types';

export type AppStrings = {
  menu: {
    a11yLabel: string;
    ideal: string;
    logout: string;
    logoutTitle: string;
    logoutBody: string;
    logoutCancel: string;
    logoutConfirm: string;
  };
  /** 固定フッターの3タブ。文字ラベルは出さないので、これは読み上げ専用の名前 */
  footer: {
    garden: string;
    reading: string;
    excuse: string;
  };
  excuse: {
    title: string;
    emptyLede: string;
    create: string;
    replace: string;
    inputLede: string;
    inputA11y: string;
    /** 上限と、アプリが型を添えることの断り。行組みは人に問わない */
    inputNote: (max: number) => string;
    next: string;
    confirmQuestion: string;
    declare: string;
    back: string;
    errorEmpty: string;
    errorTooLong: (max: number) => string;
    saveFailed: string;
    buildFailed: string;
    share: string;
    shareFailed: string;
    shareUnavailable: string;
    /** カードの面に刷る文言。宣言文と宣言日以外はここが正 */
    card: {
      /** 預かりの一文(§2-4)。行組みはサイズごとに変わる */
      custody: { square: string[]; story: string[] };
      wordmark: string;
      qrLabel: string;
    };
  };
  home: {
    emptyHeadline: string;
    savedHeadline: (days: number, time: string) => string;
    rowSaved: (actual: string, baseline: string, saved: string) => string;
    rowWaiting: string;
    observeLink: string;
    stripLabel: string;
    /**
     * 閉じ際の儀式「とじる」。一語一義: この語はホーム最下部のこのボタンにだけ使う。
     * 画面を離れてホームへ帰るだけの遷移は、どこであれ「戻る」(reading.back など)。
     */
    tojiru: string;
  };
  /** 誓い別詳細(アプリごとの取り戻しログ)。過去形・断定・静か。叱責しない */
  vowDetail: {
    declaredLine: (date: string) => string;
    baselineLine: (time: string) => string;
    totalHeadline: (time: string) => string;
    /** 取り戻した日の値。「+42分」 */
    rowSaved: (time: string) => string;
    /** 記録なし日の印。獲得0の「0分」と混同しない */
    noRecordMark: string;
    /** 記録なし日がリストにあるときだけ添える脚注(一行のみ) */
    noRecordNote: string;
    back: string;
  };
  reading: {
    listTitle: string;
    empty: string;
    back: string;
  };
  ideal: {
    title: string;
    lede: string;
    note: (max: number) => string;
    save: string;
    back: string;
    tooLong: (max: number) => string;
    saveFailed: string;
    inputA11y: string;
    editA11y: string;
  };
  declare: {
    title: string;
    baseline: (weeks: number, time: string) => string;
    note: string;
    declare: string;
    back: string;
    limitReached: string;
    failed: string;
    doneLede: (label: string) => string;
    doneWorldview: string;
    /** 言い訳カードの告知(§4.4)。宣伝はこの1箇所だけ */
    doneExcuseHint: string;
    toGarden: string;
    pickFromObserve: string;
    gatheringTitle: string;
    gatheringBody: (need: number, have: number) => string;
  };
  observe: {
    title: string;
    subtitle: string;
    note: string;
    avgPerDay: (time: string) => string;
    vowed: string;
    declareLink: string;
    gathering: (need: number, have: number) => string;
    empty: string;
    back: string;
  };
  permission: {
    androidOnly: string;
    body: string;
    note: string;
    openSettings: string;
  };
  garden: {
    /** 絵巻ビューからホームへ帰る。障子演出は再生しない(ゆえに「とじる」ではない) */
    back: string;
  };
  auth: {
    welcomeBack: string;
    startNew: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    enter: string;
    begin: string;
    createAccount: string;
    haveAccount: string;
    forgotPassword: string;
    signInFailed: string;
    signUpFailed: string;
    confirmSent: string;
    missingFields: string;
    resetTitle: string;
    resetDescription: string;
    send: string;
    emailMissing: string;
    sendFailed: string;
    resetSent: string;
    backToSignIn: string;
    newPasswordTitle: string;
    newPasswordPlaceholder: string;
    confirmPlaceholder: string;
    update: string;
    passwordTooShort: string;
    passwordMismatch: string;
    linkExpired: string;
    updateFailed: string;
    passwordChanged: string;
  };
};

const ja: AppStrings = {
  menu: {
    a11yLabel: 'メニュー',
    ideal: '理想を入力',
    logout: 'ログアウト',
    logoutTitle: 'ログアウトしますか?',
    logoutBody: '次に開くときは、もう一度ログインが必要です。',
    logoutCancel: 'やめる',
    logoutConfirm: 'ログアウト',
  },
  footer: {
    garden: '庭',
    reading: '読みもの',
    excuse: '言い訳カード',
  },
  excuse: {
    title: '言い訳カード',
    emptyLede: 'やらないことをひとつ、掲げておけます。',
    create: '宣言をつくる',
    replace: '再宣言する',
    inputLede: 'やらないことをひとつ。',
    inputA11y: 'やらないこと',
    inputNote: (max) => `全角${max}字まで。「はやらない。」は、こちらで添えます。`,
    next: 'すすむ',
    confirmQuestion: 'これを、やらないと宣言しますか。',
    declare: '宣言する',
    back: '戻る',
    errorEmpty: 'やらないことを書いてください。',
    errorTooLong: (max) => `全角${max}字以内にしてください。`,
    saveFailed: '宣言できませんでした。もう一度お試しください。',
    buildFailed: 'カードを組めませんでした。',
    share: '共有する',
    shareFailed: '書き出せませんでした。',
    shareUnavailable: 'この端末では共有できません。',
    card: {
      custody: {
        square: ['この宣言は、Yaranaiがお預かりしています。'],
        story: ['この宣言は、Yaranaiが', 'お預かりしています。'],
      },
      wordmark: 'Y a r a n a i',
      qrLabel: 'Yaranaiとは',
    },
  },
  home: {
    emptyHeadline: 'ここから、変わる。',
    savedHeadline: (days, time) => `${days}日で、${time}が\n戻ってきました。`,
    rowSaved: (actual, baseline, saved) =>
      `昨日の使用 ${actual}(ふだん ${baseline})→ ${saved}戻った`,
    rowWaiting: '昨日の実測を待っています。',
    observeLink: '時間の行き先を見る',
    stripLabel: '読みもの',
    tojiru: 'とじる',
  },
  vowDetail: {
    declaredLine: (date) => `${date}から`,
    baselineLine: (time) => `ふだん ${time}/日`,
    totalHeadline: (time) => `これまでに ${time}、\n戻ってきました。`,
    rowSaved: (time) => `+${time}`,
    noRecordMark: '—',
    noRecordNote: '記録のない日は「—」で表しています。',
    back: '戻る',
  },
  reading: {
    listTitle: '読みもの',
    empty: 'まだ、読みものはありません。',
    back: '戻る',
  },
  ideal: {
    title: '理想を、書く。',
    lede: 'なぜ、時間を取り戻すのか。',
    note: (max) => `${max}文字まで。いつでも書き直せます。`,
    save: '保存する',
    back: '戻る',
    tooLong: (max) => `${max}文字以内にしてください。`,
    saveFailed: '保存できませんでした。',
    inputA11y: '理想',
    editA11y: '理想を編集',
  },
  declare: {
    title: 'やらないことを、宣言する。',
    baseline: (weeks, time) =>
      `あなたはこの${weeks}週、\n1日平均${time}を\nこのアプリに渡していました。`,
    note: 'この平均が、あなたの「ふだん」として固定されます。\nふだんより使わなかったぶんだけ、時間が戻ります。',
    declare: '宣言する',
    back: '戻る',
    limitReached: '手元におけるのは、3つまでです。',
    failed: '宣言できませんでした。もう一度お試しください。',
    doneLede: (label) => `${label}を、手放しました。`,
    doneWorldview: 'この庭は、あなたが取り戻した時間とともに、\nゆっくり姿を変えていきます。',
    doneExcuseHint: 'やらないことを掲げておく一枚も、用意してあります。',
    toGarden: '庭へ',
    pickFromObserve: 'アプリは、観測の一覧から選んでください。',
    gatheringTitle: 'ふだんの記録を集めています',
    gatheringBody: (need, have) =>
      `この端末の記録が${need}日ぶんに満ちると、宣言できるようになります。\nいまは${have}日ぶんです。`,
  },
  observe: {
    title: '時間の行き先',
    subtitle: 'この12週、あなたの時間はここへ。',
    note: '直近7日に使ったアプリを、12週の1日平均で。\n宣言すると、この平均がそのまま、あなたの「ふだん」になります。',
    avgPerDay: (time) => `1日 平均${time}`,
    vowed: '誓いのなか',
    declareLink: 'これをやらないと宣言する',
    gathering: (need, have) =>
      `まだ記録を集めています。\nこの端末の記録が${need}日ぶんに満ちると、\n時間の行き先が見えるようになります。\nいまは${have}日ぶんです。`,
    empty: 'まだ観測が集まっていません。\nこの端末を使ううちに、静かに集まります。',
    back: '戻る',
  },
  permission: {
    androidOnly: 'この計測は、Androidの端末でだけ働きます。',
    body: 'あなたの時間の記録は、この端末の中にあります。\nYaranaiはそれを読むだけです。外には送りません。',
    note: '設定で「使用状況へのアクセス」をYaranaiに許すと、計測が始まります。',
    openSettings: '設定を開く',
  },
  garden: {
    back: '戻る',
  },
  auth: {
    welcomeBack: 'おかえりなさい',
    startNew: 'あたらしくはじめる',
    emailPlaceholder: 'メールアドレス',
    passwordPlaceholder: 'パスワード',
    enter: '入る',
    begin: 'はじめる',
    createAccount: 'アカウントをつくる',
    haveAccount: 'すでにアカウントをお持ちの方',
    forgotPassword: 'パスワードをお忘れの方',
    signInFailed: '入れませんでした。メールとパスワードを確かめてください。',
    signUpFailed: 'はじめられませんでした。少し時間をおいてもう一度。',
    confirmSent: '確認メールを送りました。メールのリンクを開いてからお入りください。',
    missingFields: 'メールとパスワードを入れてください。',
    resetTitle: 'パスワードの再設定',
    resetDescription: 'ご登録のメールアドレスに、再設定用のリンクをお送りします。',
    send: '送 る',
    emailMissing: 'メールアドレスを入れてください。',
    sendFailed: '送れませんでした。少し時間をおいてもう一度。',
    resetSent: 'パスワード再設定のメールを送りました。メールのリンクを開いてください。',
    backToSignIn: 'ログインにもどる',
    newPasswordTitle: 'あたらしいパスワード',
    newPasswordPlaceholder: 'あたらしいパスワード',
    confirmPlaceholder: 'もう一度入力',
    update: '変更する',
    passwordTooShort: 'パスワードは6文字以上にしてください。',
    passwordMismatch: 'パスワードが一致しません。',
    linkExpired: 'リンクの有効期限が切れているようです。もう一度メールを送ってください。',
    updateFailed: '変更できませんでした。もう一度お試しください。',
    passwordChanged: 'パスワードを変更しました。',
  },
};

const en: AppStrings = {
  menu: {
    a11yLabel: 'Menu',
    ideal: 'Your ideal',
    logout: 'Log out',
    logoutTitle: 'Log out?',
    logoutBody: "You'll need to sign in again next time.",
    logoutCancel: 'Not now',
    logoutConfirm: 'Log out',
  },
  footer: {
    garden: 'Garden',
    reading: 'Reading',
    excuse: 'Excuse card',
  },
  excuse: {
    title: 'Excuse card',
    emptyLede: 'You can hold up one “I won’t,”\nand leave it standing.',
    create: 'Write your declaration',
    replace: 'Declare again',
    inputLede: 'One thing you won’t do.',
    inputA11y: 'What you won’t do',
    inputNote: (max) => `Up to ${max} full-width characters. “I won’t.” is added for you.`,
    next: 'Continue',
    confirmQuestion: 'Declare that you won’t?',
    declare: 'Declare',
    back: 'Back',
    errorEmpty: 'Write down what you won’t do.',
    errorTooLong: (max) => `Keep it within ${max} full-width characters.`,
    saveFailed: "Couldn't make your declaration. Please try again.",
    buildFailed: "Couldn't compose the card.",
    share: 'Share',
    shareFailed: "Couldn't export it.",
    shareUnavailable: "This device can't share.",
    card: {
      custody: {
        square: ['Yaranai is holding this declaration.'],
        story: ['Yaranai is holding', 'this declaration.'],
      },
      wordmark: 'Y a r a n a i',
      qrLabel: 'What is Yaranai',
    },
  },
  home: {
    emptyHeadline: 'This is where it changes.',
    savedHeadline: (days, time) =>
      `In ${days} ${days === 1 ? 'day' : 'days'},\n${time} came back to you.`,
    rowSaved: (actual, baseline, saved) =>
      `Yesterday ${actual} (usually ${baseline}) → ${saved} came back`,
    rowWaiting: "Waiting for yesterday's measurement.",
    observeLink: 'See where your time goes',
    stripLabel: 'Reading',
    // 「戻る」= Back と一語一義で分ける。閉じ際の儀式だけが Close
    tojiru: 'Close',
  },
  vowDetail: {
    declaredLine: (date) => `Since ${date}`,
    baselineLine: (time) => `Usually ${time} a day`,
    totalHeadline: (time) => `So far, ${time}\nhas come back to you.`,
    rowSaved: (time) => `+${time}`,
    noRecordMark: '—',
    noRecordNote: 'Days without a record are shown as "—".',
    back: 'Back',
  },
  reading: {
    listTitle: 'Reading',
    empty: 'Nothing to read here yet.',
    back: 'Back',
  },
  ideal: {
    title: 'Write your ideal.',
    lede: 'Why take your time back?',
    note: (max) => `Up to ${max} characters. Rewrite it whenever you like.`,
    save: 'Save',
    back: 'Back',
    tooLong: (max) => `Keep it within ${max} characters.`,
    saveFailed: "Couldn't save.",
    inputA11y: 'Your ideal',
    editA11y: 'Edit your ideal',
  },
  declare: {
    title: 'Declare: I won’t.',
    baseline: (weeks, time) =>
      `Over the past ${weeks} weeks,\nyou've handed this app\n${time} a day, on average.`,
    note: 'That average is locked in as your "usual."\nUse less than usual, and the difference comes back to you.',
    declare: 'Declare',
    back: 'Back',
    limitReached: 'You can only hold three at a time.',
    failed: "Couldn't make your declaration. Please try again.",
    doneLede: (label) => `You've let go of ${label}.`,
    doneWorldview: 'This garden will slowly change shape\nalongside the time you take back.',
    doneExcuseHint: 'There is also a card, for holding up an “I won’t.”',
    toGarden: 'To the garden',
    pickFromObserve: 'Choose an app from your observations.',
    gatheringTitle: 'Learning your usual',
    gatheringBody: (need, have) =>
      `Once this device holds ${need} days of records,\nyou'll be able to declare. So far, it has ${have}.`,
  },
  observe: {
    title: 'Where your time goes',
    subtitle: 'These 12 weeks, this is where your time went.',
    note: 'Apps used in the last 7 days, as a 12-week daily average.\nDeclare one, and that average becomes your "usual."',
    avgPerDay: (time) => `avg ${time}/day`,
    vowed: 'under a vow',
    declareLink: 'Declare: I won’t use this',
    gathering: (need, have) =>
      `Still gathering records.\nOnce this device holds ${need} days' worth,\nyou'll see where your time goes.\nSo far, it has ${have}.`,
    empty: "No observations yet.\nThey'll gather quietly as you use this device.",
    back: 'Back',
  },
  permission: {
    androidOnly: 'This measurement only works on Android devices.',
    body: 'The record of your time lives on this device.\nYaranai only reads it. Nothing is sent outside.',
    note: 'Grant Yaranai "Usage access" in Settings, and measurement begins.',
    openSettings: 'Open Settings',
  },
  garden: {
    back: 'Back',
  },
  auth: {
    welcomeBack: 'Welcome back',
    startNew: 'Start fresh',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    enter: 'Enter',
    begin: 'Begin',
    createAccount: 'Create an account',
    haveAccount: 'Already have an account?',
    forgotPassword: 'Forgot your password?',
    signInFailed: "Couldn't sign you in. Check your email and password.",
    signUpFailed: "Couldn't get you started. Wait a moment and try again.",
    confirmSent: 'Confirmation email sent. Open the link, then come on in.',
    missingFields: 'Enter your email and password.',
    resetTitle: 'Reset your password',
    resetDescription: "We'll send a reset link to your registered email address.",
    send: 'Send',
    emailMissing: 'Enter your email address.',
    sendFailed: "Couldn't send it. Wait a moment and try again.",
    resetSent: 'Reset email sent. Open the link inside.',
    backToSignIn: 'Back to sign in',
    newPasswordTitle: 'A new password',
    newPasswordPlaceholder: 'New password',
    confirmPlaceholder: 'Once more',
    update: 'Update',
    passwordTooShort: 'Use at least 6 characters.',
    passwordMismatch: "The passwords don't match.",
    linkExpired: 'That link seems to have expired. Please send yourself another email.',
    updateFailed: "Couldn't update it. Please try again.",
    passwordChanged: 'Your password has been updated.',
  },
};

export const STRINGS: Record<Lang, AppStrings> = { ja, en };
