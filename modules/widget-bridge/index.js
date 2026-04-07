// modules/widget-bridge/index.js
import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

let _module = null;
function getModule() {
  if (!_module) {
    try {
      _module = requireNativeModule('WidgetBridge');
    } catch {
      // Native module not available (web or module not linked)
      _module = {
        updateData: async () => {},
        reloadTimelines: async () => {},
        getPendingShare: async () => null,
        clearPendingShare: async () => {},
      };
    }
  }
  return _module;
}

/**
 * Write widget data JSON string to the platform's shared store.
 * Android: app filesDir/widget_data.json
 * iOS: App Group UserDefaults (group.com.beforeitbills.app)
 */
export async function updateWidgetData(json) {
  return getModule().updateData(json);
}

/**
 * iOS only: tell WidgetKit to reload all timelines immediately.
 * No-op on Android.
 */
export async function reloadWidgetTimelines() {
  return getModule().reloadTimelines();
}

/**
 * iOS only: read the pending share payload written by the Share Extension.
 * Returns a JSON string like { text?, url?, subject?, sharedAt }, or null.
 */
export async function getPendingShare() {
  return getModule().getPendingShare();
}

/**
 * iOS only: clear the pending share after the main app has consumed it.
 */
export async function clearPendingShare() {
  return getModule().clearPendingShare();
}
