package com.sosguardian.sender.data

import kotlinx.coroutines.*
import okhttp3.*

// Secure WebSocket to backend /v1/stream?token=&sessionId= with backoff reconnect (spec §11).
class StreamClient(private val baseHttp: String, private val token: String, private val sessionId: String, private val onEvent: (String) -> Unit) {
  private var ws: WebSocket? = null
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  fun connect() {
    scope.launch {
      var delayMs = 1000L
      while (currentCoroutineContext().isActive) {
        try {
          val url = baseHttp.replace("http", "ws").trimEnd('/') + "/v1/stream?token=$token&sessionId=$sessionId"
          ws = OkHttpClient().newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onMessage(w: WebSocket, text: String) { onEvent(text) }
            override fun onFailure(w: WebSocket, t: Throwable, r: Response?) { w.close(1000, null) }
          })
          delayMs = 1000L
          break
        } catch (_: Throwable) { delay(delayMs); delayMs = (delayMs * 2).coerceAtMost(15000L) }
      }
    }
  }
  fun close() { try { ws?.close(1000, null) } catch (_: Throwable) {}; scope.cancel() }
}
