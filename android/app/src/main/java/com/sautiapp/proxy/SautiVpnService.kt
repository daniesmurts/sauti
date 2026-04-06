package com.sautiapp.proxy

import android.app.Service
import android.content.Intent
import android.net.VpnService
import android.os.IBinder
import android.os.ParcelFileDescriptor

class SautiVpnService : VpnService() {
  private var activeTunFd: ParcelFileDescriptor? = null

  companion object {
    const val ACTION_START = "com.sautiapp.proxy.START"
    const val ACTION_STOP = "com.sautiapp.proxy.STOP"

    private const val SESSION_NAME = "Sauti"
    private const val TUN_ADDRESS = "10.0.0.1"
    private const val TUN_PREFIX = 24
    private const val TUN_MTU = 1500

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
        val tunFd = Builder()
          .setSession(SESSION_NAME)
          .addAddress(TUN_ADDRESS, TUN_PREFIX)
          .setMtu(TUN_MTU)
          .establish()
        if (tunFd == null) {
          markFailure("VPN interface could not be established.")
          stopSelf()
        } else {
          activeTunFd?.close()
          activeTunFd = tunFd
          markRunning()
          // TODO: attach V2Ray core here — start tun2socks forwarding activeTunFd
          // through V2Ray VLESS+WebSocket+TLS. Add routes once binary is embedded.
        }
      }
      ACTION_STOP -> {
        activeTunFd?.close()
        activeTunFd = null
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
    activeTunFd?.close()
    activeTunFd = null
    markStopped()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? {
    return super.onBind(intent)
  }
}
