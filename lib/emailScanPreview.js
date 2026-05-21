// lib/emailScanPreview.js
import * as SecureStore from "expo-secure-store";

const KEY = "emailsScannedCount_v1";
export const EMAIL_SCAN_FREE_CAP = 100;

export async function getEmailsScannedCount() {
  const raw = await SecureStore.getItemAsync(KEY);
  const n = Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function setEmailsScannedCount(n) {
  const safe = Math.max(0, Math.floor(Number(n) || 0));
  await SecureStore.setItemAsync(KEY, String(safe));
  return safe;
}

export async function incrementEmailsScanned(by = 1) {
  const current = await getEmailsScannedCount();
  const next = current + Math.max(0, Math.floor(Number(by) || 0));
  await setEmailsScannedCount(next);
  return next;
}

export async function getEmailsRemaining() {
  const used = await getEmailsScannedCount();
  return Math.max(0, EMAIL_SCAN_FREE_CAP - used);
}

// Pro users are never capped - returns Infinity for them.
export async function getEmailsRemainingForUser(isPro = false) {
  if (isPro) return Infinity;
  return getEmailsRemaining();
}
