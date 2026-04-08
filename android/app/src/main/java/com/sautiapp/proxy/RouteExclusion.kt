package com.sautiapp.proxy

import java.net.InetAddress

/**
 * Builds a minimal set of IPv4 CIDR routes that covers the entire address space
 * (0.0.0.0/0) **except** for one specific host IP.  This is used to ensure the
 * V2Ray server's own traffic bypasses the VPN tunnel, preventing a routing loop.
 *
 * Algorithm: walk from bit 0 to bit 31.  At each level, the target IP falls into
 * one of two /N+1 halves.  Add the *other* half to the result, then recurse into
 * the half that still contains the target.  Produces exactly 32 routes.
 *
 * Example: excluding 1.2.3.4 yields routes like 0.0.0.0/1, 128.0.0.0/2, …
 * which together cover all IPv4 except 1.2.3.4/32.
 */
internal object RouteExclusion {

  data class Route(val address: String, val prefixLength: Int)

  /**
   * Returns a list of routes that cover 0.0.0.0/0 excluding [excludeAddress].
   * Falls back to the two standard /1 routes when [excludeAddress] is null or
   * cannot be resolved, accepting the minor routing-loop risk.
   */
  fun buildIpv4RoutesExcluding(excludeAddress: String?): List<Route> {
    if (excludeAddress == null) return defaultRoutes()

    val ip: InetAddress = try {
      InetAddress.getByName(excludeAddress)
    } catch (_: Exception) {
      return defaultRoutes()
    }

    val targetInt = ipToInt(ip.address)
    val routes = mutableListOf<Route>()
    var networkInt = 0
    var prefixLen = 0

    for (bit in 0 until 32) {
      // Width of each half at this level (e.g. bit=0 → halfWidth=31 → halves are /1)
      val halfWidth = 31 - bit
      val midpoint = networkInt or (1 shl halfWidth)

      // Which bit of the target corresponds to this level?
      val targetBit = (targetInt ushr halfWidth) and 1

      if (targetBit == 0) {
        // Target is in the left half [networkInt, midpoint).
        // Add right half [midpoint, networkInt + 2^(32-bit)) as a route.
        routes.add(Route(intToIpString(midpoint), prefixLen + 1))
        // Recurse into left half — networkInt stays the same.
      } else {
        // Target is in the right half.
        // Add left half [networkInt, midpoint) as a route.
        routes.add(Route(intToIpString(networkInt), prefixLen + 1))
        // Recurse into right half.
        networkInt = midpoint
      }

      prefixLen++
    }
    // At this point networkInt is exactly the 32-bit target — don't add it.
    return routes
  }

  // Two /1 routes covering 0.0.0.0/0 — used when route exclusion is unavailable.
  private fun defaultRoutes(): List<Route> = listOf(
    Route("0.0.0.0", 1),
    Route("128.0.0.0", 1),
  )

  private fun ipToInt(bytes: ByteArray): Int =
    ((bytes[0].toInt() and 0xFF) shl 24) or
      ((bytes[1].toInt() and 0xFF) shl 16) or
      ((bytes[2].toInt() and 0xFF) shl 8) or
      (bytes[3].toInt() and 0xFF)

  private fun intToIpString(value: Int): String =
    "${(value ushr 24) and 0xFF}.${(value ushr 16) and 0xFF}" +
      ".${(value ushr 8) and 0xFF}.${value and 0xFF}"
}
