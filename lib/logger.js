// lib/logger.js
// Minimal, local-first error logging.
// Goal: crash-free baseline + actionable logs without waiting for a full Sentry setup.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ERRORS_KEY = 'sublytics:errors:v1';
const MAX = 50;

let _inited = false;

function normalizeError(err) {
  if (!err) return { name: 'Error', message: 'Unknown error', stack: null };
  if (typeof err === 'string') return { name: 'Error', message: err, stack: null };
  return {
    name: err.name || 'Error',
    message: err.message || String(err),
    stack: err.stack || null,
  };
}

export async function logError(err, context = {}) {
  try {
    const e = normalizeError(err);
    const item = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      ts: new Date().toISOString(),
      ...e,
      context,
    };

    const raw = await AsyncStorage.getItem(ERRORS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [item, ...(Array.isArray(list) ? list : [])].slice(0, MAX);
    await AsyncStorage.setItem(ERRORS_KEY, JSON.stringify(next));
  } catch {
    // never crash while logging a crash 🙃
  }
}

export async function getErrorLogs() {
  try {
    const raw = await AsyncStorage.getItem(ERRORS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function clearErrorLogs() {
  try {
    await AsyncStorage.removeItem(ERRORS_KEY);
  } catch {
    // ignore
  }
}

export function initErrorLogging() {
  if (_inited) return;
  _inited = true;

  // Unhandled promise rejections (best-effort)
  try {
    const prev = globalThis.onunhandledrejection;
    globalThis.onunhandledrejection = (event) => {
      logError(event?.reason, { type: 'unhandledrejection' });
      prev?.(event);
    };
  } catch {
    // ignore
  }

  // Global JS exceptions
  try {
    const ErrorUtils = global.ErrorUtils;
    if (ErrorUtils?.setGlobalHandler) {
      const defaultHandler = ErrorUtils.getGlobalHandler?.();
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        logError(error, { type: 'global', isFatal: !!isFatal });
        // Keep default behavior so devs still see redbox in dev.
        defaultHandler?.(error, isFatal);
      });
    }
  } catch {
    // ignore
  }
}
