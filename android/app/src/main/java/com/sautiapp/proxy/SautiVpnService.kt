package com.sautiapp.proxy

import android.app.Service
import android.content.Intent
import android.net.VpnService
import android.os.IBinder
import android.os.ParcelFileDescriptor
import android.system.ErrnoException
import android.system.OsConstants
import android.util.Log
import java.io.File
import java.net.InetAddress

/**
 * Android VPN service that tunnels all device traffic through a V2Ray
 * VLESS+WebSocket+TLS proxy.
 *
 * Startup sequence (on a background thread):
 *   1. Extract v2ray + tun2socks binaries from APK assets (once per APK version).
 *   2. Resolve the V2Ray server hostname so we can exclude it from TUN routes,
 *      preventing a routing loop.
 *   3. Establish the TUN interface via VpnService.Builder, routing all IPv4/v6
 *      traffic except the V2Ray server's IP through the tunnel.
 *   4. Write the V2Ray JSON config and start the v2ray subprocess.
 *   5. Poll until the SOCKS5 inbound port is open (≤10 s).
 *   6. Clear FD_CLOEXEC on the TUN fd and start the tun2socks subprocess, which
 *      reads from the TUN fd and forwards to V2Ray's SOCKS5 port.
 *
 * Shutdown:
 *   SIGTERM → 3-second grace period → SIGKILL for each subprocess.
 *   TUN fd closed, foreground notification dismissed.
 *
 * Binary assets must be placed at assets/bin/<abi>/v2ray and
 * assets/bin/<abi>/tun2socks before building.  See scripts/download-v2ray-binaries.sh.
 */
class SautiVpnService : VpnService() {

  private var activeTunFd: ParcelFileDescriptor? = null
  private val v2rayProc = SubprocessManager("SautiV2Ray")
  private val tun2socksProc = SubprocessManager("SautiTun2socks")

  @Volatile private var startupThread: Thread? = null

  companion object {
    private const val TAG = "SautiVpnService"

    const val ACTION_START = "com.sautiapp.proxy.START"
    const val ACTION_STOP = "com.sautiapp.proxy.STOP"

    // Intent extras carrying the V2Ray config (set by SautiProxyModule.enable())
    const val EXTRA_UUID = "v2ray_uuid"
    const val EXTRA_HOST = "v2ray_host"
    const val EXTRA_PORT = "v2ray_port"
    const val EXTRA_WS_PATH = "v2ray_ws_path"

    private const val SESSION_NAME = "Sauti"
    private const val TUN_ADDRESS = "10.0.0.1"
    private const val TUN_PREFIX = 24
    private const val TUN_MTU = 1500

    @Volatile var isRunning: Boolean = false; private set
    @Volatile var permissionRequired: Boolean = false; private set
    @Volatile var lastError: String? = null; private set

    fun markPermissionRequired(msg: String) {
      isRunning = false; permissionRequired = true; lastError = msg
    }
    fun markRunning() { isRunning = true; permissionRequired = false; lastError = null }
    fun markStopped() { isRunning = false; permissionRequired = false }
    fun markFailure(msg: String) { isRunning = false; permissionRequired = false; lastError = msg }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override fun onCreate() {
    super.onCreate()
    VpnNotificationManager.createChannel(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> handleStart(intent)
      ACTION_STOP -> handleStop()
      else -> { /* system restart with null intent — keep running or no-op */ }
    }
    return Service.START_STICKY
  }

  override fun onDestroy() {
    tearDown()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = super.onBind(intent)

  // ── Start ──────────────────────────────────────────────────────────────────

  private fun handleStart(intent: Intent) {
    // Parse V2Ray config from intent extras
    val v2rayConfig = intent.extractV2RayConfig()
    if (v2rayConfig == null) {
      Log.w(TAG, "No V2Ray config in intent — cannot start tunnel.")
      markFailure("V2Ray configuration is required to start the VPN tunnel.")
      stopSelf()
      return
    }

    // Tear down any previous tunnel before rebuilding
    stopSubprocesses()
    activeTunFd?.close()
    activeTunFd = null

    // Resolve server IP first so we can exclude it from TUN routes
    val serverIp = resolveHostname(v2rayConfig.host)
    Log.i(TAG, "V2Ray server ${v2rayConfig.host} resolved to $serverIp")

    // Build TUN interface with routes excluding the V2Ray server's IP
    val routes = RouteExclusion.buildIpv4RoutesExcluding(serverIp)
    val builder = Builder()
      .setSession(SESSION_NAME)
      .addAddress(TUN_ADDRESS, TUN_PREFIX)
      .setMtu(TUN_MTU)
      .addDnsServer("8.8.8.8")
      .addDnsServer("8.8.4.4")
      .addRoute("::0", 0) // IPv6 catch-all (V2Ray server assumed IPv4)

    for (route in routes) {
      builder.addRoute(route.address, route.prefixLength)
    }

    val tunFd = builder.establish()
    if (tunFd == null) {
      markFailure("VPN interface could not be established.")
      stopSelf()
      return
    }

    activeTunFd = tunFd

    // Show foreground notification — required on Android 8+ for long-running services
    startForeground(
      VpnNotificationManager.FOREGROUND_NOTIFICATION_ID,
      VpnNotificationManager.buildConnectedNotification(this),
    )

    // Heavy work (binary extraction, subprocess startup) runs on a background thread
    val thread = Thread({
      try {
        startTunnel(tunFd, v2rayConfig)
      } catch (e: InterruptedException) {
        Log.d(TAG, "Startup thread interrupted.")
      } catch (e: Exception) {
        Log.e(TAG, "Tunnel startup failed: ${e.message}", e)
        markFailure(e.message ?: "Tunnel startup failed.")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }, "vpn-startup")
    thread.isDaemon = true
    thread.start()
    startupThread = thread
  }

  // ── Tunnel startup (background thread) ────────────────────────────────────

  private fun startTunnel(tunFd: ParcelFileDescriptor, config: V2RayConfig) {
    // 1. Extract binaries (no-op after first run unless APK updated)
    val bins = BinaryManager.ensureBinaries(this)

    // 2. Write V2Ray config JSON
    val configFile = File(filesDir, "v2ray_config.json")
    configFile.writeText(V2RayConfigBuilder.build(config))
    Log.i(TAG, "V2Ray config written: ${configFile.absolutePath}")

    // 3. Start v2ray subprocess
    v2rayProc.start(
      listOf(bins.v2ray.absolutePath, "run", "-config", configFile.absolutePath),
    )

    // 4. Wait for v2ray SOCKS5 port to open
    Log.i(TAG, "Waiting for v2ray SOCKS5 port ${config.socksPort}…")
    if (!SubprocessManager.waitForPort(config.socksPort)) {
      throw IllegalStateException(
        "v2ray did not open SOCKS5 port ${config.socksPort} within 10 s. " +
          "Check logcat for 'SautiV2Ray' tag.",
      )
    }
    Log.i(TAG, "v2ray SOCKS5 port ${config.socksPort} ready.")

    // 5. Clear FD_CLOEXEC on the TUN fd so the tun2socks subprocess can inherit it.
    //    Os.fcntl is not in the public Android SDK API; we invoke it via reflection.
    val rawFd = tunFd.fd
    try {
      val javaFd = tunFd.fileDescriptor
      @Suppress("DiscouragedPrivateApi")
      val fcntlMethod = android.system.Os::class.java
        .getMethod("fcntl", java.io.FileDescriptor::class.java, Int::class.javaPrimitiveType, Int::class.javaPrimitiveType)
      val flags = (fcntlMethod.invoke(null, javaFd, OsConstants.F_GETFD, 0) as Int)
      fcntlMethod.invoke(null, javaFd, OsConstants.F_SETFD, flags and OsConstants.FD_CLOEXEC.inv())
      Log.d(TAG, "Cleared FD_CLOEXEC on TUN fd $rawFd")
    } catch (e: Exception) {
      // Non-fatal — subprocess may still inherit the fd depending on Android version
      Log.w(TAG, "Could not clear FD_CLOEXEC on TUN fd: ${e.message}")
    }

    // 6. Start tun2socks: reads TUN fd, forwards all traffic to v2ray's SOCKS5 port
    tun2socksProc.start(
      listOf(
        bins.tun2socks.absolutePath,
        "-device", "fd://$rawFd",
        "-proxy", "socks5://127.0.0.1:${config.socksPort}",
        "-loglevel", "warning",
      ),
    )

    if (!tun2socksProc.isAlive()) {
      throw IllegalStateException(
        "tun2socks exited immediately after launch. " +
          "Check logcat for 'SautiTun2socks' tag.",
      )
    }

    markRunning()
    Log.i(TAG, "VPN tunnel is active. All traffic routed via v2ray → ${config.host}:${config.port}")
  }

  // ── Stop ──────────────────────────────────────────────────────────────────

  private fun handleStop() {
    tearDown()
  }

  private fun tearDown() {
    stopSubprocesses()
    activeTunFd?.close()
    activeTunFd = null
    markStopped()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun stopSubprocesses() {
    startupThread?.interrupt()
    startupThread = null
    tun2socksProc.stop()
    v2rayProc.stop()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Resolves [hostname] to a dotted-decimal IPv4 string, or null on failure. */
  private fun resolveHostname(hostname: String): String? {
    return try {
      InetAddress.getByName(hostname).hostAddress
    } catch (e: Exception) {
      Log.w(TAG, "DNS resolution failed for '$hostname': ${e.message}")
      null
    }
  }

  private fun Intent.extractV2RayConfig(): V2RayConfig? {
    val uuid = getStringExtra(EXTRA_UUID) ?: return null
    val host = getStringExtra(EXTRA_HOST) ?: return null
    val port = getIntExtra(EXTRA_PORT, 443)
    val wsPath = getStringExtra(EXTRA_WS_PATH) ?: "/"
    return V2RayConfig(uuid = uuid, host = host, port = port, wsPath = wsPath)
  }
}
