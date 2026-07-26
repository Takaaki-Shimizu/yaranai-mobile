// 表示言語の React コンテキスト。ルートレイアウトで LanguageProvider を張り、
// 各画面は useT()(文言辞書)と useLang()(現在言語+切替)で読む。
//
// 初期値は 'ja'。保存済みの言語は起動後に非同期で反映される(1フレーム日本語が
// 見える可能性はあるが、スプラッシュ〜ローディング中に解決するため実害はない)。

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LANG, type Lang } from './types';
import { STRINGS, type AppStrings } from './strings';
import { loadLang, saveLang } from './storage';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    let alive = true;
    loadLang().then((v) => {
      if (alive) setLangState(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang: (next: Lang) => {
        setLangState(next);
        saveLang(next); // 書き込みは投げっぱなしでよい(失敗しても表示は切り替わる)
      },
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}

// 現在言語の文言辞書。画面側は t.home.emptyHeadline のように読む。
export function useT(): AppStrings {
  return STRINGS[useContext(LanguageContext).lang];
}
