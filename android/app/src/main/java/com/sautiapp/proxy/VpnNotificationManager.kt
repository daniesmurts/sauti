package com.sautiapp.proxy

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.sautiapp.R

/**
 * Builds and manages the foreground notification that Android requires for any
 * long-running VPN service.  Without a visible notification the service will be
 * killed on Android 8+ shortly after moving to the background.
 */
internal object VpnNotificationManager {

  const val FOREGROUND_NOTIFICATION_ID = 1001
  private const val CHANNEL_ID = "sauti_vpn_service"

  /** Creates the notification channel.  Safe to call repeatedly. */
  fun createChannel(context: Context) {
    val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.vpn_notification_channel_name),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = context.getString(R.string.vpn_notification_channel_desc)
      setShowBadge(false)
    }
    mgr.createNotificationChannel(channel)
  }

  /** Returns a persistent notification shown while the VPN tunnel is active. */
  fun buildConnectedNotification(context: Context): Notification {
    val stopIntent = Intent(context, SautiVpnService::class.java).apply {
      action = SautiVpnService.ACTION_STOP
    }
    val stopPi = PendingIntent.getService(
      context,
      0,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(context.getString(R.string.vpn_notification_title))
      .setContentText(context.getString(R.string.vpn_notification_text))
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(
        android.R.drawable.ic_delete,
        context.getString(R.string.vpn_notification_action_disconnect),
        stopPi,
      )
      .build()
  }
}
