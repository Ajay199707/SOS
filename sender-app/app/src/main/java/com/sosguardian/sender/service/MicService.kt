package com.sosguardian.sender.service

import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.sosguardian.sender.webrtc.SenderAudioClient
import kotlinx.coroutines.*

// Mic foreground service (spec §8): starts while app in permitted state, persistent notification,
// never bypasses OS mic indicator. Audio via WebRTC; no recording by default.
class MicService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var audio: SenderAudioClient? = null

  override fun onCreate() {
    super.onCreate()
    val ch = "sos_mic"
    getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(ch, "Emergency audio", NotificationManager.IMPORTANCE_LOW))
    startForeground(2, NotificationCompat.Builder(this, ch)
      .setContentTitle("SOS Guardian: live audio")
      .setContentText("Selected contacts may hear surroundings.")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now).build())
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val sessionId = intent?.getStringExtra("sessionId") ?: return START_NOT_STICKY
    scope.launch {
      try {
        audio = SenderAudioClient(this@MicService, sessionId).also { it.start() }
      } catch (t: Throwable) {
        // Notify sender where possible; receiver shows audio unavailable (handled via signaling state)
        stopSelf()
      }
    }
    return START_STICKY
  }

  override fun onDestroy() { scope.launch { try { audio?.stop() } catch (_: Throwable) {} }; scope.cancel(); super.onDestroy() }
  override fun onBind(i: Intent?): IBinder? = null
}
