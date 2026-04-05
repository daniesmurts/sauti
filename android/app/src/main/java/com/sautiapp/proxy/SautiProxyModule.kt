package com.sautiapp.proxy

import android.content.Intent
import android.net.VpnService
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
      promise.reject(
        "PROXY_PERMISSION_REQUIRED",
        "VPN permission is required before enabling the proxy service.",
      )
      return
    }

    val serviceIntent = Intent(context, SautiVpnService::class.java).apply {
      action = SautiVpnService.ACTION_START
    }

    context.startService(serviceIntent)
    promise.resolve(true)
  }

  @ReactMethod
  fun disable(promise: Promise) {
    val serviceIntent = Intent(context, SautiVpnService::class.java).apply {
      action = SautiVpnService.ACTION_STOP
    }

    context.startService(serviceIntent)
    promise.resolve(false)
  }

  @ReactMethod
  fun isEnabled(promise: Promise) {
    promise.resolve(SautiVpnService.isRunning)
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    val status = if (SautiVpnService.isRunning) "connected" else "disabled"
    promise.resolve(status)
  }
}
