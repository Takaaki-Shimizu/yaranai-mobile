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
import type { ContactDiagnostics } from '../contact';

export type AppStrings = {
  menu: {
    a11yLabel: string;
    ideal: string;
    settings: string;
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
    /** 許可を「あとで」にした人への静かな案内(オンボーディング §4)。警告色は使わない */
    noAccessNotice: string;
    noAccessLink: string;
    /**
     * 蓄積が引けず、端末にも手がかりが無いときの一行。
     * 宣言前の空文言(emptyHeadline)を代わりに出さないための面で、
     * 「失われた」と読める語は使わない。読めていない、とだけ言う
     */
    gardenUnavailable: string;
    /** 上の一行に添える、もう一度だけの導線。促さず、置くだけ */
    gardenRetry: string;
    savedHeadline: (days: number, time: string) => string;
    /**
     * 取り戻しがまだ0のあいだ、savedHeadline と同じ位置に置く一行。
     * 宣言した直後の庭とアプリ行の間を埋め、次に何が出るかだけを静かに伝える
     */
    savedPending: string;
    rowSaved: (actual: string, baseline: string, saved: string) => string;
    rowWaiting: string;
    observeLink: string;
    stripLabel: string;
    /** 卒業できる誓いにだけ静かに現れる一行。促さない(卒業機能 §5-1) */
    graduateLink: string;
    /** 卒業済みの誓いに添える小さなラベル。数字は出さない */
    graduatedLabel: string;
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
    /** オンボーディングで宣言のあとに通るときだけ、「戻る」の位置に出す */
    skip: string;
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
    /** オンボーディングでは庭の手前に理想を書く画面が挟まるので、行き先を名指さない */
    next: string;
    /** オンボーディングで枠がまだ空いているとき。時間の行き先へ返して、続きを委ねる */
    chooseMore: string;
    pickFromObserve: string;
    gatheringTitle: string;
    gatheringBody: (need: number, have: number) => string;
    /** 復帰モード(卒業機能 §5-3)。基準線は再計算せず、固定された値をそのまま出す */
    restoreBaseline: (time: string) => string;
    restoreNote: string;
    restore: string;
    restoreFailed: string;
  };
  /**
   * 卒業の儀式(卒業機能 §5-2)。成功でしか通らない画面やけん、
   * 労わず、褒めそやさず、ただ事実と次の一歩だけを置く。
   */
  graduate: {
    lede: (label: string) => string;
    note: string;
    graduate: string;
    back: string;
    failed: string;
    doneLede: (label: string) => string;
    doneWorldview: string;
    toGarden: string;
  };
  observe: {
    title: string;
    subtitle: string;
    note: string;
    avgPerDay: (time: string) => string;
    vowed: string;
    declareLink: string;
    /** 卒業済みのアプリがぶり返して再浮上したときだけ出る(卒業機能 §5-3) */
    restoreLink: string;
    gathering: (need: number, have: number) => string;
    empty: string;
    back: string;
    /** オンボーディング時だけ画面下部に出す一行(§5)。ボタンではなく道しるべ */
    onboardingGuide: string;
    /** オンボーディングで一覧の手前に置く断り。少なくとも1つ、多くて3つ(§5) */
    onboardingRule: (max: number) => string;
    /** いま何つ選んだか。「次へすすむ」の足元に添える(§6) */
    onboardingChosen: (chosen: number, max: number) => string;
    /** 1つ以上選んだときだけ出す、理想を書く画面への一歩(§6) */
    next: string;
  };
  permission: {
    androidOnly: string;
    body: string;
    note: string;
    openSettings: string;
    /** 許可せずホームへ抜ける静かな脇道(オンボーディング §4)。強制はしない */
    later: string;
  };
  /** 世界観導入(オンボーディング §1)。文言は仮。煽り・カウントダウンは入れない */
  worldview: {
    lede: string;
    body: string;
    skip: string;
    next: string;
  };
  /** メール確認待ち(オンボーディング §3) */
  confirmEmail: {
    title: string;
    body: string;
    resend: string;
    /** 連打防止の残り秒。急かす表現にしない */
    resendWait: (sec: number) => string;
    resent: string;
    resendFailed: string;
    wrongEmail: string;
  };
  /** 目立つ開示(オンボーディング §4)。何を・何のために読むか、外に出る範囲はどこまでか */
  disclosure: {
    what: string;
    boundary: string;
    action: string;
  };
  /** 待機モード(オンボーディング §5)。「あと◯日」のカウントダウン表現はしない */
  waiting: {
    body: (days: number) => string;
    note: string;
    proceed: string;
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
    /** 同意行(オンボーディング §2)。リンク部分だけ別要素にするため分割して持つ */
    agreePrefix: string;
    termsLink: string;
    agreeAnd: string;
    privacyLink: string;
    agreeSuffix: string;
    consentA11y: string;
    /** Google認証(§2)。ボタン文言はサインアップが「Googleではじめる」 */
    googleBegin: string;
    googleEnter: string;
    googleFailed: string;
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
  /** 設定画面(設定+お問い合わせ スペック §3)。制度の棚 ── 日常的に触る機能は置かない */
  settings: {
    title: string;
    sectionAbout: string;
    contact: string;
    sectionRules: string;
    privacy: string;
    terms: string;
    sectionAccount: string;
    deleteAccount: string;
    /** バージョン行。タップ不可のテキスト */
    versionLine: (version: string, build: string) => string;
    back: string;
    mailSubject: string;
    /**
     * メール本文(§4.2)。冒頭の3行はユーザーが書き始めるための空白。
     * 診断情報は本文に平文で見え、送る前に消せる ── 「裏で何かを送っていない」
     * ことの構造的な保証なので、「不要であれば削除してください」の一行は必ず残す
     */
    mailBody: (d: ContactDiagnostics) => string;
    /** メールアプリ未設定の端末向け(§4.4)。アドレスはコピーできる形で出す */
    fallbackBody: string;
    copy: string;
    copied: string;
    fallbackClose: string;
  };
  /** アカウント削除の確認画面(§5)。事実だけを述べる。煽らない・引き止めない */
  deleteAccount: {
    title: string;
    lede: string;
    items: string[];
    note: string;
    confirm: string;
    back: string;
    failed: string;
  };
};

const ja: AppStrings = {
  menu: {
    a11yLabel: 'メニュー',
    ideal: '理想を入力',
    settings: '設定',
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
    next: '次へすすむ',
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
    noAccessNotice: '計測を始めるには、\n使用状況へのアクセスの許可が必要です。',
    noAccessLink: '許可について読む',
    gardenUnavailable: 'いまは、庭を読み込めませんでした。\n積んだものは、そのままです。',
    gardenRetry: 'もう一度読み込む',
    savedHeadline: (days, time) => `${days}日で、${time}が\n戻ってきました。`,
    savedPending: '明日から、取り戻した時間が\nここに表示されます。',
    rowSaved: (actual, baseline, saved) =>
      `昨日の使用 ${actual}(ふだん ${baseline})→ ${saved}戻った`,
    rowWaiting: '昨日の実測を待っています。',
    observeLink: '時間の行き先を見る',
    stripLabel: '読みもの',
    graduateLink: '卒業する',
    graduatedLabel: '卒業',
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
    skip: 'とばす',
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
    next: '次へすすむ',
    chooseMore: 'つづけて選ぶ',
    pickFromObserve: 'アプリは、観測の一覧から選んでください。',
    gatheringTitle: 'ふだんの記録を集めています',
    gatheringBody: (need, have) =>
      `この端末の記録が${need}日ぶんに満ちると、宣言できるようになります。\nいまは${have}日ぶんです。`,
    restoreBaseline: (time) => `あなたの「ふだん」は、\n${time}のまま変わりません。`,
    restoreNote: 'ここから、もう一度。',
    restore: '計測に戻す',
    restoreFailed: '計測に戻せませんでした。もう一度お試しください。',
  },
  graduate: {
    lede: (label) => `${label}は、この7日、\n一度も開かれていません。`,
    note: '卒業しても、この誓いは静かに数え続けます。\nぶり返したときは、いつでも手元に戻せます。',
    graduate: '卒業する',
    back: '戻る',
    failed: '卒業できませんでした。もう一度お試しください。',
    doneLede: (label) => `${label}を、卒業しました。`,
    doneWorldview: '空いた手で、次の『やらない』を。',
    toGarden: '庭へ',
  },
  observe: {
    title: '時間の行き先',
    subtitle: 'この12週、あなたの時間はここへ。',
    note: '直近7日に使ったアプリを、12週の1日平均で。\n宣言すると、この平均がそのまま、あなたの「ふだん」になります。',
    avgPerDay: (time) => `1日 平均${time}`,
    vowed: '誓いのなか',
    declareLink: 'これをやらないと宣言する',
    restoreLink: '計測に戻す',
    gathering: (need, have) =>
      `まだ記録を集めています。\nこの端末の記録が${need}日ぶんに満ちると、\n時間の行き先が見えるようになります。\nいまは${have}日ぶんです。`,
    empty: 'まだ観測が集まっていません。\nこの端末を使ううちに、静かに集まります。',
    back: '戻る',
    onboardingGuide: 'この中から、やらないものを選ぶ',
    onboardingRule: (max) => `すくなくとも1つ。\nここでは${max}つまで選べます。`,
    onboardingChosen: (chosen, max) =>
      chosen >= max ? `${max}つ、選びました。` : `いま${chosen}つ。あと${max - chosen}つ選べます。`,
    next: '次へすすむ',
  },
  permission: {
    androidOnly: 'この計測は、Androidの端末でだけ働きます。',
    body: 'あなたの時間の記録は、この端末の中にあります。\nYaranaiはそれを読むだけです。外には送りません。',
    note: '設定で「使用状況へのアクセス」をYaranaiに許すと、計測が始まります。',
    openSettings: '設定を開く',
    later: 'あとで',
  },
  worldview: {
    lede: 'スマホに渡していた時間を、\n静かに取り戻す。',
    body: '「やらない」とひとつ決める。\nそのぶんだけ、あなたの庭が育ちます。',
    skip: 'とばす',
    next: '次へすすむ',
  },
  confirmEmail: {
    title: '確認メールを送りました',
    body: 'メールのリンクを開いてからお入りください。',
    resend: 'メールを再送する',
    resendWait: (sec) => `再送は${sec}秒ほど、お待ちください。`,
    resent: '送りました。',
    resendFailed: '送れませんでした。少し時間をおいてもう一度。',
    wrongEmail: 'メールアドレスを間違えた方',
  },
  disclosure: {
    what: 'Yaranaiは、この端末にある\nアプリごとの利用時間の統計を読み取ります。\nあなたの「ふだん」を知り、\n取り戻した時間を測るためです。',
    boundary:
      '全アプリの利用記録は、この端末の中にだけ残ります。\nサーバーに送られるのは、あなたが「やらない」と\n宣言したアプリの1日ごとの合計時間と、\nその基準線だけです。',
    action: 'わかった、設定へ',
  },
  waiting: {
    body: (days) => `あなたの時間の記録を、端末が集めています。\nいま${days}日目です。`,
    note: '記録が満ちるころ、\nやらないことを選べるようになります。',
    proceed: '次へすすむ',
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
    agreePrefix: '',
    termsLink: '利用規約',
    agreeAnd: ' と ',
    privacyLink: 'プライバシーポリシー',
    agreeSuffix: ' に同意する',
    consentA11y: '利用規約とプライバシーポリシーに同意する',
    googleBegin: 'Googleではじめる',
    googleEnter: 'Googleで入る',
    googleFailed: 'Googleでは入れませんでした。少し時間をおいてもう一度。',
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
  settings: {
    title: '設定',
    sectionAbout: 'このアプリについて',
    contact: 'お問い合わせ',
    sectionRules: 'きまりごと',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    sectionAccount: 'アカウント',
    deleteAccount: 'アカウントを削除する',
    versionLine: (version, build) => `Yaranai ${version} (${build})`,
    back: '戻る',
    mailSubject: 'Yaranai お問い合わせ',
    mailBody: (d) =>
      [
        '',
        '',
        '',
        '――― 以下は不具合調査のための情報です ―――',
        '（不要であれば削除してください）',
        '',
        `アプリ: Yaranai ${d.version} (${d.build})`,
        `Android: ${d.androidVersion}`,
        `端末: ${d.deviceModel}`,
        `記録日数: ${d.recordedDays == null ? '取得できず' : `${d.recordedDays}日`}`,
        `宣言数: ${d.vowCount}`,
        `ID: ${d.userId}`,
      ].join('\n'),
    fallbackBody:
      'お使いの端末でメールアプリが開けませんでした。\nお手数ですが、下のアドレス宛にご連絡ください。',
    copy: 'コピー',
    copied: 'コピーしました',
    fallbackClose: 'もどる',
  },
  deleteAccount: {
    title: 'アカウントを削除します',
    lede: '削除すると、次のものが失われます。',
    items: ['あなたの宣言', '記録した日々', '育ってきた庭'],
    note: 'これらは元に戻せません。\n同じメールアドレスで登録し直しても、庭は最初からになります。\n\n端末内の利用記録も、あわせて消去されます。',
    confirm: '削除する',
    back: 'もどる',
    failed: '削除できませんでした。時間をおいてもう一度お試しください。',
  },
};

const en: AppStrings = {
  menu: {
    a11yLabel: 'Menu',
    ideal: 'Your ideal',
    settings: 'Settings',
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
    noAccessNotice: 'To begin measuring, Yaranai needs\nthe "Usage access" permission.',
    noAccessLink: 'Read about the permission',
    gardenUnavailable: "The garden couldn't be loaded just now.\nWhat you've built is still there.",
    gardenRetry: 'Load it again',
    savedHeadline: (days, time) =>
      `In ${days} ${days === 1 ? 'day' : 'days'},\n${time} came back to you.`,
    savedPending: 'From tomorrow, the time that\ncomes back will appear here.',
    rowSaved: (actual, baseline, saved) =>
      `Yesterday ${actual} (usually ${baseline}) → ${saved} came back`,
    rowWaiting: "Waiting for yesterday's measurement.",
    observeLink: 'See where your time goes',
    stripLabel: 'Reading',
    graduateLink: 'Graduate',
    graduatedLabel: 'graduated',
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
    skip: 'Skip',
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
    next: 'Continue',
    chooseMore: 'Choose another',
    pickFromObserve: 'Choose an app from your observations.',
    gatheringTitle: 'Learning your usual',
    gatheringBody: (need, have) =>
      `Once this device holds ${need} days of records,\nyou'll be able to declare. So far, it has ${have}.`,
    restoreBaseline: (time) => `Your "usual" is still ${time}.\nIt hasn't changed.`,
    restoreNote: 'From here, once more.',
    restore: 'Measure this again',
    restoreFailed: "Couldn't put it back under measurement. Please try again.",
  },
  graduate: {
    lede: (label) => `You haven't opened ${label} once\nin the last seven days.`,
    note: 'Even after you graduate, this vow keeps counting, quietly.\nIf it comes back, you can bring it to hand again.',
    graduate: 'Graduate',
    back: 'Back',
    failed: "Couldn't graduate. Please try again.",
    doneLede: (label) => `You've graduated from ${label}.`,
    doneWorldview: 'With a free hand, the next "I won\'t."',
    toGarden: 'To the garden',
  },
  observe: {
    title: 'Where your time goes',
    subtitle: 'These 12 weeks, this is where your time went.',
    note: 'Apps used in the last 7 days, as a 12-week daily average.\nDeclare one, and that average becomes your "usual."',
    avgPerDay: (time) => `avg ${time}/day`,
    vowed: 'under a vow',
    declareLink: 'Declare: I won’t use this',
    restoreLink: 'Measure this again',
    gathering: (need, have) =>
      `Still gathering records.\nOnce this device holds ${need} days' worth,\nyou'll see where your time goes.\nSo far, it has ${have}.`,
    empty: "No observations yet.\nThey'll gather quietly as you use this device.",
    back: 'Back',
    onboardingGuide: "From these, choose what you won't do",
    onboardingRule: (max) => `At least one.\nYou can choose up to ${max} here.`,
    onboardingChosen: (chosen, max) =>
      chosen >= max
        ? `You've chosen ${max}.`
        : `${chosen} so far. You can choose ${max - chosen} more.`,
    next: 'Continue',
  },
  permission: {
    androidOnly: 'This measurement only works on Android devices.',
    body: 'The record of your time lives on this device.\nYaranai only reads it. Nothing is sent outside.',
    note: 'Grant Yaranai "Usage access" in Settings, and measurement begins.',
    openSettings: 'Open Settings',
    later: 'Later',
  },
  worldview: {
    lede: 'Quietly take back the time\nyou were handing to your phone.',
    body: 'Decide on one "I won\'t."\nYour garden grows by that much.',
    skip: 'Skip',
    next: 'Continue',
  },
  confirmEmail: {
    title: 'Confirmation email sent',
    body: 'Open the link inside, then come on in.',
    resend: 'Send it again',
    resendWait: (sec) => `Please wait about ${sec} seconds before resending.`,
    resent: 'Sent.',
    resendFailed: "Couldn't send it. Wait a moment and try again.",
    wrongEmail: 'Entered the wrong address?',
  },
  disclosure: {
    what: 'Yaranai reads the per-app usage statistics\nheld on this device —\nto learn your "usual," and to measure\nthe time that comes back to you.',
    boundary:
      'The usage log of all your apps stays on this device.\nOnly the daily totals of the apps you declare\n"I won\'t" for, and their baselines,\nare sent to the server.',
    action: 'Understood — to Settings',
  },
  waiting: {
    body: (days) => `This device is gathering the record of your time.\nDay ${days}, so far.`,
    note: "Once the record fills in,\nyou'll be able to choose what you won't do.",
    proceed: 'Continue',
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
    agreePrefix: 'I agree to the ',
    termsLink: 'Terms of Service',
    agreeAnd: ' and ',
    privacyLink: 'Privacy Policy',
    agreeSuffix: '.',
    consentA11y: 'Agree to the Terms of Service and the Privacy Policy',
    googleBegin: 'Start with Google',
    googleEnter: 'Enter with Google',
    googleFailed: "Couldn't get you in with Google. Wait a moment and try again.",
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
  settings: {
    title: 'Settings',
    sectionAbout: 'About this app',
    contact: 'Contact us',
    sectionRules: 'Policies',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    sectionAccount: 'Account',
    deleteAccount: 'Delete your account',
    versionLine: (version, build) => `Yaranai ${version} (${build})`,
    back: 'Back',
    mailSubject: 'Yaranai — Contact',
    mailBody: (d) =>
      [
        '',
        '',
        '',
        '――― The details below help us look into issues ―――',
        '(Feel free to delete them.)',
        '',
        `App: Yaranai ${d.version} (${d.build})`,
        `Android: ${d.androidVersion}`,
        `Device: ${d.deviceModel}`,
        `Recorded days: ${d.recordedDays ?? 'unavailable'}`,
        `Vows: ${d.vowCount}`,
        `ID: ${d.userId}`,
      ].join('\n'),
    fallbackBody:
      "This device couldn't open a mail app.\nPlease reach us at the address below.",
    copy: 'Copy',
    copied: 'Copied',
    fallbackClose: 'Back',
  },
  deleteAccount: {
    title: 'Delete your account',
    lede: 'Deleting it means losing:',
    items: ['your declarations', 'the days you recorded', 'the garden that has grown'],
    note: 'These cannot be brought back.\nEven if you sign up again with the same email, the garden starts over.\n\nUsage records on this device will be erased as well.',
    confirm: 'Delete',
    back: 'Back',
    failed: "Couldn't delete your account. Please wait a while and try again.",
  },
};

export const STRINGS: Record<Lang, AppStrings> = { ja, en };
