package com.sautiapp.proxy

import org.json.JSONArray
import org.json.JSONObject

internal data class V2RayConfig(
  val uuid: String,
  val host: String,
  val port: Int = 443,
  val wsPath: String = "/",
  val socksPort: Int = DEFAULT_SOCKS_PORT,
) {
  companion object {
    const val DEFAULT_SOCKS_PORT = 10808
  }
}

/**
 * Generates a v2ray-core JSON configuration for a VLESS+WebSocket+TLS outbound
 * with a local SOCKS5 inbound that tun2socks forwards into.
 *
 * Traffic flow:
 *   App → TUN → tun2socks → SOCKS5:10808 → v2ray → VLESS/WS/TLS → server
 */
internal object V2RayConfigBuilder {

  fun build(config: V2RayConfig): String {
    val root = JSONObject()

    root.put("log", JSONObject().apply {
      put("loglevel", "warning")
    })

    // SOCKS5 inbound — tun2socks connects here
    root.put("inbounds", JSONArray().apply {
      put(JSONObject().apply {
        put("tag", "socks-in")
        put("protocol", "socks")
        put("listen", "127.0.0.1")
        put("port", config.socksPort)
        put("settings", JSONObject().apply {
          put("auth", "noauth")
          put("udp", true)
        })
      })
    })

    root.put("outbounds", JSONArray().apply {
      // Primary: VLESS over WebSocket + TLS
      put(JSONObject().apply {
        put("tag", "vless-out")
        put("protocol", "vless")
        put("settings", JSONObject().apply {
          put("vnext", JSONArray().apply {
            put(JSONObject().apply {
              put("address", config.host)
              put("port", config.port)
              put("users", JSONArray().apply {
                put(JSONObject().apply {
                  put("id", config.uuid)
                  put("encryption", "none")
                })
              })
            })
          })
        })
        put("streamSettings", JSONObject().apply {
          put("network", "ws")
          put("security", "tls")
          put("wsSettings", JSONObject().apply {
            put("path", config.wsPath)
          })
          put("tlsSettings", JSONObject().apply {
            put("serverName", config.host)
            put("allowInsecure", false)
          })
        })
      })

      // Fallback: direct for loopback / LAN traffic
      put(JSONObject().apply {
        put("tag", "direct")
        put("protocol", "freedom")
      })
    })

    // Routing: send loopback and link-local direct; everything else via VLESS
    root.put("routing", JSONObject().apply {
      put("domainStrategy", "IPIfNonMatch")
      put("rules", JSONArray().apply {
        put(JSONObject().apply {
          put("type", "field")
          put("ip", JSONArray().apply {
            put("127.0.0.0/8")
            put("::1/128")
            put("fc00::/7")
          })
          put("outboundTag", "direct")
        })
        put(JSONObject().apply {
          put("type", "field")
          put("network", "tcp,udp")
          put("outboundTag", "vless-out")
        })
      })
    })

    return root.toString(2)
  }
}
