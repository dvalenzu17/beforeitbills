package expo.modules.widgetbridge

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class WidgetBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WidgetBridge")

    /**
     * Write subscription JSON to filesDir/widget_data.json.
     * The SubsWidgetProvider reads this file when it renders.
     */
    AsyncFunction("updateData") { json: String ->
      val ctx = appContext.reactContext
        ?: throw IllegalStateException("React context unavailable")
      writeWidgetData(ctx, json)
      triggerWidgetRefresh(ctx)
    }

    /** No-op on Android (WidgetKit reload is iOS-only). */
    AsyncFunction("reloadTimelines") { }
  }

  private fun writeWidgetData(ctx: Context, json: String) {
    val file = File(ctx.filesDir, WIDGET_DATA_FILE)
    file.writeText(json)
  }

  private fun triggerWidgetRefresh(ctx: Context) {
    try {
      // Resolve the widget provider class by name so this module doesn't
      // need a hard compile-time dependency on the app module.
      val providerClass = Class.forName(WIDGET_PROVIDER_CLASS)
      val mgr = AppWidgetManager.getInstance(ctx)
      val ids = mgr.getAppWidgetIds(ComponentName(ctx, providerClass))
      if (ids.isNotEmpty()) {
        val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
          component = ComponentName(ctx, providerClass)
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        ctx.sendBroadcast(intent)
      }
    } catch (_: ClassNotFoundException) {
      // Widget provider not in this build — ignore
    }
  }

  companion object {
    const val WIDGET_DATA_FILE = "widget_data.json"
    const val WIDGET_PROVIDER_CLASS =
      "com.dvalenzu17.sublytics.widget.SubsWidgetProvider"
  }
}
