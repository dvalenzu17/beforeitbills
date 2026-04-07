// modules/widget-bridge/ios/WidgetBridgeModule.swift
import ExpoModulesCore
import WidgetKit

private let APP_GROUP        = "group.com.beforeitbills.app"
private let WIDGET_DATA_KEY  = "widget_data"
private let PENDING_SHARE_KEY = "bib_pending_share"

public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    // Write JSON string to App Group UserDefaults so the widget extension can read it.
    AsyncFunction("updateData") { (json: String) in
      guard let defaults = UserDefaults(suiteName: APP_GROUP) else {
        throw NSError(
          domain: "WidgetBridge",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "App Group '\(APP_GROUP)' not configured."]
        )
      }
      defaults.set(json, forKey: WIDGET_DATA_KEY)
      defaults.synchronize()
    }

    // Ask WidgetKit to reload all timelines for this app.
    AsyncFunction("reloadTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }

    // Read a pending share payload written by the Share Extension.
    // Returns the JSON string, or nil if there is nothing pending.
    AsyncFunction("getPendingShare") { () -> String? in
      guard let defaults = UserDefaults(suiteName: APP_GROUP) else { return nil }
      return defaults.string(forKey: PENDING_SHARE_KEY)
    }

    // Remove the pending share after the main app has consumed it.
    AsyncFunction("clearPendingShare") {
      guard let defaults = UserDefaults(suiteName: APP_GROUP) else { return }
      defaults.removeObject(forKey: PENDING_SHARE_KEY)
      defaults.synchronize()
    }
  }
}
