package expo.modules.usagestats

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// 端末の利用統計を読むだけのモジュール。書き込み・ブロック・通知は持たない。
class UsageStatsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("UsageStats")

    // 使用状況アクセスが許可されとるか。AppOps のモードで判定する。
    Function("hasUsageAccess") {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName,
        )
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName,
        )
      }
      mode == AppOpsManager.MODE_ALLOWED
    }

    // OSの「使用状況へのアクセス」設定画面を開く。許可の判断は利用者に委ねる。
    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    // beginMs〜endMs の集計。OSが日次/週次/月次のバケットを自動で選ぶため、
    // 窓が古いほど粗い集計になる(保持期間: 日次7日・週次4週・月次6ヶ月)。
    Function("queryUsage") { beginMs: Double, endMs: Double ->
      val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usageStatsManager.queryAndAggregateUsageStats(beginMs.toLong(), endMs.toLong())
      stats.values
        .filter { it.totalTimeInForeground > 0 }
        .map {
          mapOf(
            "packageName" to it.packageName,
            "totalForegroundMs" to it.totalTimeInForeground,
          )
        }
    }
  }
}
