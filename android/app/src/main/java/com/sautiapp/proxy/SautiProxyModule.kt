package com.sautiapp.proxy

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ActivityEventListener

class SautiProxyModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener {

  private var vpnPermissionPromise: Promise? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName(): String = "SautiProxyModule"

  @ReactMethod
  fun init(promise: Promise) {
    val permissionIntent = VpnService.prepare(context)
    if (permissionIntent != null) {
      SautiVpnService.markPermissionRequired(
        "VPN permission is required before initializing the proxy service.",
      )
      promise.reject(
        "PROXY_PERMISSION_REQUIRED",
        "VPN permission is required before initializing the proxy service.",
      )
      return
    }

    promise.resolve(SautiVpnService.isRunning)
  }

  @ReactMethod
  fun enable(promise: Promise) {
    val permissionIntent = VpnService.prepare(context)
    if (permissionIntent != null) {
      SautiVpnService.markPermissionRequired(
        "VPN permission is required before enabling the proxy service.",
      )
      promise.reject(
        "PROXY_PERMISSION_REQUIRED",
        "VPN permission is required before enabling the proxy service.",
      )
      return
    }

    val serviceIntent = Intent(context, SautiVpnService::class.java).apply {
      action = SautiVpnService.ACTION_START
    }

    try {
      context.startService(serviceIntent)
      promise.resolve(true)
    } catch (error: Exception) {
      SautiVpnService.markFailure(error.message ?: "Failed to start VPN service.")
      promise.reject("PROXY_ENABLE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun disable(promise: Promise) {
    val serviceIntent = Intent(context, SautiVpnService::class.java).apply {
      action = SautiVpnService.ACTION_STOP
    }

    try {
      context.startService(serviceIntent)
      promise.resolve(false)
    } catch (error: Exception) {
      SautiVpnService.markFailure(error.message ?: "Failed to stop VPN service.")
      promise.reject("PROXY_DISABLE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun isEnabled(promise: Promise) {
    promise.resolve(SautiVpnService.isRunning)
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    val status = when {
      SautiVpnService.isRunning -> "connected"
      SautiVpnService.permissionRequired || SautiVpnService.lastError != null -> "failed"
      else -> "disabled"
    }
    promise.resolve(status)
  }

  @ReactMethod
  fun getDiagnostics(promise: Promise) {
    val diagnostics = Arguments.createMap().apply {
      putString(
        "status",
        when {
          SautiVpnService.isRunning -> "connected"
          SautiVpnService.permissionRequired || SautiVpnService.lastError != null -> "failed"
          else -> "disabled"
        },
      )
      putBoolean("isRunning", SautiVpnService.isRunning)
      putBoolean("permissionRequired", SautiVpnService.permissionRequired)
      if (SautiVpnService.lastError != null) {
        putString("lastError", SautiVpnService.lastError)
      } else {
        putNull("lastError")
      }
    }

    promise.resolve(diagnostics)
  }

  @ReactMethod
  fun requestVpnPermission(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject(
        "NO_ACTIVITY",
        "No current activity available to present VPN permission dialog.",
      )
      return
    }

    val permissionIntent = VpnService.prepare(activity)
    if (permissionIntent == null) {
      promise.resolve(true)
      return
    }

    vpnPermissionPromise = promise
    try {
      activity.startActivityForResult(permissionIntent, VPN_PERMISSION_REQUEST_CODE)
    } catch (error: Exception) {
      vpnPermissionPromise = null
      promise.reject("VPN_PERMISSION_REQUEST_FAILED", error.message, error)
    }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    if (requestCode != VPN_PERMISSION_REQUEST_CODE) {
      return
    }

    val promise = vpnPermissionPromise ?: return
    vpnPermissionPromise = null

    if (resultCode == Activity.RESULT_OK) {
      promise.resolve(true)
    } else {
      promise.reject("VPN_PERMISSION_DENIED", "User denied VPN permission.")
    }
  }

  override fun onNewIntent(intent: Intent) {
    // Not handled.
  }

  companion object {
    private const val VPN_PERMISSION_REQUEST_CODE = 0x5a27
  }
}
