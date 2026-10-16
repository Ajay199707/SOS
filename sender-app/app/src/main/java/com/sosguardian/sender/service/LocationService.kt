package com.sosguardian.sender.service

import android.app.*
import android.content.Intent
import android.os.*
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.sosguardian.sender.data.SosRepository
import com.sosguardian.sender.util.retryIO
import kotlinx.coroutines.*

// Foreground location sharing (spec §7): 5s target, immediate on meaningful change, stale marking, survives screen-off.
class LocationService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private lateinit var fused: FusedLocationProviderClient
  private var sessionId: String? = null
  private var lastSent = 0L

  override fun onCreate() {
    super.onCreate()
    fused = LocationServices.getFusedLocationProviderClient(this)
    startForeground(1, buildNotif("Sharing location…"))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    sessionId = intent?.getStringExtra("sessionId")
    startUpdates()
    return START_STICKY
  }

  @SuppressWarnings("MissingPermission")
  private fun startUpdates() {
    val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L)
      .setMinUpdateDistanceMeters(5f)
      .setMaxUpdateDelayMillis(10000L)
      .build()
    try {
      fused.requestLocationUpdates(req, object : LocationCallback() {
        override fun onLocationResult(r: LocationResult) {
          val loc = r.lastLocation ?: return
          scope.launch {
            val id = sessionId ?: return@launch
            val now = System.currentTimeMillis()
            if (now - lastSent < 2000 && loc.accuracy > 50) return@launch // adaptive: skip noisy
            lastSent = now
            val repo = SosRepository(this@LocationService)
            try {
              retryIO(maxAttempts = 3) {
                repo.api().postLocation(id, mapOf(
                  "lat" to loc.latitude, "lon" to loc.longitude,
                  "accuracyM" to loc.accuracy.toDouble(),
                  "speedMps" to (if (loc.hasSpeed()) loc.speed.toDouble() else null),
                  "provider" to loc.provider, "isStale" to false
                ))
              }
            } catch (t: Throwable) {
              // Persist locally for sync when connectivity returns (spec §11)
              getSharedPreferences("sos_pending", MODE_PRIVATE).edit()
                .putString("loc_${now}", "${loc.latitude},${loc.longitude}").apply()
            }
          }
        }
      }, Looper.getMainLooper())
    } catch (t: SecurityException) {
      stopSelf() // permission revoked: receiver shows audio/location unavailable, alert continues
    }
  }

  private fun buildNotif(text: String): Notification {
    val ch = "sos_loc"
    getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(ch, "Emergency location", NotificationManager.IMPORTANCE_LOW))
    return NotificationCompat.Builder(this, ch).setContentTitle("SOS Guardian active")
      .setContentText(text).setSmallIcon(android.R.drawable.ic_dialog_alert).build()
  }

  override fun onBind(i: Intent?) = null
  override fun onDestroy() { scope.cancel(); super.onDestroy() }
}
