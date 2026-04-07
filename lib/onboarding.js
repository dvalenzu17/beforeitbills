// lib/onboarding.js
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ONBOARDING_DONE = "onboarding_done";
export const LANG_KEY = "lang";

export async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_DONE, "1");
}

export async function resetOnboarding() {
  await AsyncStorage.removeItem(ONBOARDING_DONE);
}

export async function getSavedLanguage() {
  return AsyncStorage.getItem(LANG_KEY);
}
