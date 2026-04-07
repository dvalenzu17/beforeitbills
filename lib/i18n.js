// lib/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import en from "../locales/en.json";
import es from "../locales/es.json";
import pt from "../locales/pt.json";
import fr from "../locales/fr.json";

const LANG_KEY = "lang";

const resources = {
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
  fr: { translation: fr },
};

const normalizeLang = (raw) => {
  if (!raw) return "en";
  const short = String(raw).toLowerCase().split(/[-_]/)[0];
  return ["en", "es", "pt", "fr"].includes(short) ? short : "en";
};

let _bootPromise = null;

export async function bootstrapI18n() {
  const saved = await AsyncStorage.getItem(LANG_KEY);
  const deviceTag = Localization.getLocales?.()?.[0]?.languageTag;
  const device = normalizeLang(deviceTag);
  const lng = normalizeLang(saved || device);

  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        resources,
        lng,
        fallbackLng: "en",
        compatibilityJSON: "v3",
        interpolation: { escapeValue: false },
        returnNull: false,
      });
  } else if (i18n.language !== lng) {
    await i18n.changeLanguage(lng);
  }

  return lng;
}

export function ensureI18n() {
  if (!_bootPromise) _bootPromise = bootstrapI18n();
  return _bootPromise;
}

export async function setAppLanguage(lang) {
  await ensureI18n(); // ✅ prevent hasLanguageSomeTranslations crash
  const lng = normalizeLang(lang);
  await AsyncStorage.setItem(LANG_KEY, lng);
  await i18n.changeLanguage(lng);
  return lng;
}

export function getAppLanguage() {
  return i18n.language || "en";
}

export default i18n;
