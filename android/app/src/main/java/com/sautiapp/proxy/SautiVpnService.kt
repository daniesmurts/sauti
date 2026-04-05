package com.sautiapp.proxy

import android.app.Service
import android.content.Intent
import android.net.VpnService
import android.os.IBinder

class SautiVpnService : VpnService() {
  companion object {
    const val ACTION_START = "com.sautiapp.proxy.START"
    const val ACTION_STOP = "com.sautiapp.proxy.STOP"

    @Volatile
    var isRunning: Boolean = false
      private set
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        // Phase-1 scaffold: reserve service lifecycle contract for native V2Ray integration.
        isRunning = true
      }
      ACTION_STOP -> {
        isRunning = false
        stopSelf()
      }
      else -> {
        // Keep current state for no-op starts.
      }
    }

    return Service.START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? {
    return super.onBind(intent)
  }
}
