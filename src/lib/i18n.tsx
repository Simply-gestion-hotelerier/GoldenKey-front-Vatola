import React, { createContext, useContext, useMemo, useState } from "react";

export type Lang = "fr" | "en";

export type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  locale: string;
  t: (path: string) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

import { translations } from "./translations";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>((localStorage.getItem("lang") as Lang) || "fr");
  const value = useMemo(() => ({
    lang,
    setLang: (l: Lang) => {
      localStorage.setItem("lang", l);
      setLang(l);
    },
    locale: lang === "fr" ? "fr-FR" : "en-US",
    t: (path: string) => {
      const parts = path.split(".");
      let node: any = translations[lang as keyof typeof translations];
      for (const p of parts) {
        node = node?.[p];
        if (node == null) break;
      }
      return typeof node === "string" ? node : path;
    },
  }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
