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

    @Volatile
    var permissionRequired: Boolean = false
      private set

    @Volatile
    var lastError: String? = null
      private set

    fun markPermissionRequired(message: String) {
      isRunning = false
      permissionRequired = true
      lastError = message
    }

    fun markRunning() {
      isRunning = true
      permissionRequired = false
      lastError = null
    }

    fun markStopped() {
      isRunning = false
      permissionRequired = false
    }

    fun markFailure(message: String) {
      isRunning = false
      permissionRequired = false
      lastError = message
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        // Phase-1 scaffold: reserve service lifecycle contract for native V2Ray integration.
        markRunning()
      }
      ACTION_STOP -> {
        markStopped()
        stopSelf()
      }
      else -> {
        // Keep current state for no-op starts.
      }
    }

    return Service.START_STICKY
  }

  override fun onDestroy() {
    markStopped()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? {
    return super.onBind(intent)
  }
}
