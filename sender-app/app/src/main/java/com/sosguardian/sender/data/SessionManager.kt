package com.sosguardian.sender.data

import android.content.Context
import android.content.Intent
import com.sosguardian.sender.service.LocationService
import com.sosguardian.sender.service.MicService
import com.sosguardian.sender.util.idempotencyKey
import com.sosguardian.sender.util.retryIO
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// Emergency activation workflow (spec §6): parallel ops, idempotent, never block alert on GPS/audio.
class SessionManager(private val ctx: Context, private val repo: SosRepository) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val _sessionId = MutableStateFlow<String?>(null)
  val sessionId: StateFlow<String?> = _sessionId
  private val _status = MutableStateFlow(SubsystemStatus())
  val status: StateFlow<SubsystemStatus> = _status
  private var currentKey: String? = null

  fun activate(contactIds: List<String>, onDone: (String) -> Unit, onError: (String) -> Unit) {
    if (_sessionId.value != null) { onDone(_sessionId.value!!); return } // idempotent: repeated presses
    scope.launch {
      val key = currentKey ?: idempotencyKey().also { currentKey = it }
      try {
        // 1. Create session FIRST - do not wait for GPS/audio (spec §6)
        val session = retryIO { repo.api().createSession(mapOf("idempotencyKey" to key, "contactIds" to contactIds)) }
        _sessionId.value = session.id
        withContext(Dispatchers.Main) { onDone(session.id) }
        // 2. Parallel: location service, mic service, notify - each tolerates failure
        launch { startLocation(session.id) }
        launch { startAudio(session.id) }
        launch { notifyWithRetry(session.id) }
      } catch (t: Throwable) {
        withContext(Dispatchers.Main) { onError(t.message ?: "activation failed") }
      }
    }
  }

  private suspend fun startLocation(sessionId: String) {
    try {
      ctx.startForegroundService(Intent(ctx, LocationService::class.java).putExtra("sessionId", sessionId))
      _status.value = _status.value.copy(gps = "STARTING")
    } catch (t: Throwable) { _status.value = _status.value.copy(gps = "FAILED: ${t.message}") }
  }

  private suspend fun startAudio(sessionId: String) {
    try {
      ctx.startForegroundService(Intent(ctx, MicService::class.java).putExtra("sessionId", sessionId))
      _status.value = _status.value.copy(audio = "CONNECTING")
    } catch (t: Throwable) { _status.value = _status.value.copy(audio = "FAILED: ${t.message}") }
  }

  private suspend fun notifyWithRetry(sessionId: String) {
    try {
      retryIO(maxAttempts = 4) { repo.api().notify(sessionId) }
      _status.value = _status.value.copy(notify = "SENT")
    } catch (t: Throwable) { _status.value = _status.value.copy(notify = "PARTIALLY_DELIVERED") }
  }

  fun cancel() {
    val id = _sessionId.value ?: return
    scope.launch {
      try { repo.api().cancel(id) } catch (_: Throwable) {}
      try { repo.api().setState(id, mapOf("to" to "RESOLVED")) } catch (_: Throwable) {}
      ctx.stopService(Intent(ctx, LocationService::class.java))
      ctx.stopService(Intent(ctx, MicService::class.java))
      _sessionId.value = null
      currentKey = null
      _status.value = SubsystemStatus()
    }
  }
}
