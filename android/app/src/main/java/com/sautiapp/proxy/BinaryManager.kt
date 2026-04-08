package com.sautiapp.proxy

import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import java.io.FileOutputStream

internal data class ExtractedBinaries(
  val v2ray: File,
  val tun2socks: File,
)

/**
 * Extracts the v2ray and tun2socks binaries from APK assets to the app's private
 * files directory. Re-extracts automatically when the APK is updated (compared via
 * last-modified timestamp).
 *
 * Expected asset layout:
 *   assets/bin/<abi>/v2ray
 *   assets/bin/<abi>/tun2socks
 *
 * Run `scripts/download-v2ray-binaries.sh` to populate the assets before building.
 */
internal object BinaryManager {

  private const val TAG = "BinaryManager"
  private const val STAMP_FILENAME = "bin_extraction_stamp"
  private val SUPPORTED_ABIS = setOf("arm64-v8a", "armeabi-v7a", "x86_64")

  /**
   * Ensures both binaries are present and up-to-date in [Context.getFilesDir]/bin/.
   * Safe to call from a background thread.
   *
   * @throws IllegalStateException if either binary is missing from assets.
   */
  fun ensureBinaries(context: Context): ExtractedBinaries {
    val abi = resolveAbi()
    val binDir = File(context.filesDir, "bin").also { it.mkdirs() }
    val stampFile = File(binDir, STAMP_FILENAME)
    val apkFile = File(context.applicationInfo.sourceDir)
    val apkModified = apkFile.lastModified()

    val stampValue = if (stampFile.exists()) {
      stampFile.readText().trim().toLongOrNull()
    } else {
      null
    }

    val v2rayFile = File(binDir, "v2ray")
    val tun2socksFile = File(binDir, "tun2socks")
    val needsExtraction = stampValue != apkModified || !v2rayFile.exists() || !tun2socksFile.exists()

    if (needsExtraction) {
      Log.i(TAG, "Extracting binaries for abi=$abi")
      extractBinary(context, "bin/$abi/v2ray", v2rayFile)
      extractBinary(context, "bin/$abi/tun2socks", tun2socksFile)
      v2rayFile.setExecutable(true, false)
      tun2socksFile.setExecutable(true, false)
      stampFile.writeText(apkModified.toString())
      Log.i(TAG, "Binaries extracted: v2ray=${v2rayFile.length()}B tun2socks=${tun2socksFile.length()}B")
    } else {
      Log.d(TAG, "Binaries are up-to-date.")
    }

    return ExtractedBinaries(v2ray = v2rayFile, tun2socks = tun2socksFile)
  }

  private fun resolveAbi(): String {
    for (abi in Build.SUPPORTED_ABIS) {
      if (abi in SUPPORTED_ABIS) return abi
    }
    val fallback = Build.SUPPORTED_ABIS.firstOrNull() ?: "arm64-v8a"
    Log.w(TAG, "No shipped ABI matched ${Build.SUPPORTED_ABIS.toList()}, using $fallback")
    return fallback
  }

  private fun extractBinary(context: Context, assetPath: String, dest: File) {
    try {
      context.assets.open(assetPath).use { input ->
        FileOutputStream(dest).use { output ->
          input.copyTo(output)
        }
      }
    } catch (e: Exception) {
      throw IllegalStateException(
        "Binary not found in assets at '$assetPath'. " +
          "Run scripts/download-v2ray-binaries.sh before building.",
        e,
      )
    }
  }
}
