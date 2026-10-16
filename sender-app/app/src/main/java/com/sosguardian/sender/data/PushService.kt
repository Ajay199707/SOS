package com.sosguardian.sender.data

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.*

// Receiver-side push also reused on sender for ack/resolved updates.
class PushService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    CoroutineScope(Dispatchers.IO).launch {
      try { SosRepository(this@PushService).api().registerDevice(mapOf("fcmToken" to token, "platform" to "android")) }
      catch (_: Throwable) {}
    }
  }
  override fun onMessageReceived(m: RemoteMessage) {
    // System tray shows notification; Emergency Mode UI refreshes via WS /v1/stream.
  }
}
