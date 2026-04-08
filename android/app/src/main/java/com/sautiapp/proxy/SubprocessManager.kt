package com.sautiapp.proxy

import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.Socket
import java.util.concurrent.TimeUnit

/**
 * Manages the lifecycle of a single child process (v2ray or tun2socks).
 * Stdout and stderr are drained to logcat on a daemon thread.
 */
internal class SubprocessManager(private val tag: String) {

  @Volatile private var process: Process? = null

  /** Starts the process. Kills any previously running instance first. */
  fun start(cmd: List<String>) {
    stop()
    Log.i(tag, "Starting: ${cmd.joinToString(" ")}")
    val proc = ProcessBuilder(cmd)
      .redirectErrorStream(true)
      .start()
    process = proc
    drainToLogcat(proc)
  }

  /**
   * Sends SIGTERM, waits up to 3 s for clean exit, then force-kills.
   * Safe to call when no process is running.
   */
  fun stop() {
    val proc = process ?: return
    process = null
    proc.destroy()
    val clean = proc.waitFor(3, TimeUnit.SECONDS)
    if (!clean) {
      proc.destroyForcibly()
      Log.w(tag, "Process did not exit cleanly; force-killed.")
    } else {
      Log.i(tag, "Process exited with code ${proc.exitValue()}.")
    }
  }

  fun isAlive(): Boolean = process?.isAlive == true

  private fun drainToLogcat(proc: Process) {
    Thread({
      try {
        BufferedReader(InputStreamReader(proc.inputStream)).use { reader ->
          var line = reader.readLine()
          while (line != null) {
            Log.d(tag, line)
            line = reader.readLine()
          }
        }
      } catch (_: Exception) { /* process closed — expected */ }
    }, "$tag-reader").apply {
      isDaemon = true
      start()
    }
  }

  companion object {
    /**
     * Polls [host]:[port] with TCP connect attempts until the port is open or
     * [timeoutMs] is exhausted.  Returns true if the port opened in time.
     */
    fun waitForPort(
      port: Int,
      host: String = "127.0.0.1",
      timeoutMs: Long = 10_000,
      pollIntervalMs: Long = 300,
    ): Boolean {
      val deadline = System.currentTimeMillis() + timeoutMs
      while (System.currentTimeMillis() < deadline) {
        try {
          Socket(host, port).use { return true }
        } catch (_: Exception) {
          Thread.sleep(pollIntervalMs)
        }
      }
      return false
    }
  }
}
