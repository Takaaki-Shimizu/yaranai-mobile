package expo.modules.usagestats

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val TAG = "UsageStats"

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

    // 指定粒度(0=日次/1=週次/2=月次)の生バケットをそのまま返す。
    // 注意: queryUsageStats は「範囲に重なるバケットを丸ごと」返すため、begin〜end に
    // 収まらんバケットも混ざる(queryAndAggregateUsageStats で週合計が膨らんだ原因)。
    // 範囲内かどうかは JS側が firstTimeStamp で判定する。集計はここではしない。
    // 保持期間: 日次7日・週次4週・月次6ヶ月。
    Function("queryUsageBuckets") { intervalType: Int, beginMs: Double, endMs: Double ->
      val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val interval = when (intervalType) {
        0 -> UsageStatsManager.INTERVAL_DAILY
        1 -> UsageStatsManager.INTERVAL_WEEKLY
        2 -> UsageStatsManager.INTERVAL_MONTHLY
        else -> UsageStatsManager.INTERVAL_DAILY
      }
      val stats = usageStatsManager.queryUsageStats(interval, beginMs.toLong(), endMs.toLong())
      val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
      Log.d(
        TAG,
        "queryUsageBuckets interval=$intervalType " +
          "range=${fmt.format(Date(beginMs.toLong()))}..${fmt.format(Date(endMs.toLong()))} " +
          "buckets=${stats.size}"
      )
      stats.map {
        // 調査用: クエリが返した生バケットを全件ログに出す(adb logcat -s UsageStats)
        Log.d(
          TAG,
          "bucket pkg=${it.packageName} " +
            "first=${fmt.format(Date(it.firstTimeStamp))}(${it.firstTimeStamp}) " +
            "last=${fmt.format(Date(it.lastTimeStamp))}(${it.lastTimeStamp}) " +
            "fgMs=${it.totalTimeInForeground}"
        )
        mapOf(
          "packageName" to it.packageName,
          "firstTimeStamp" to it.firstTimeStamp,
          "lastTimeStamp" to it.lastTimeStamp,
          "totalForegroundMs" to it.totalTimeInForeground,
        )
      }
    }
  }
}
