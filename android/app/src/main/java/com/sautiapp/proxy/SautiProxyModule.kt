package com.sautiapp.proxy

import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SautiProxyModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

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
}
