package com.sosguardian.sender

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

class SosApp : Application() {
  override fun onCreate() {
    super.onCreate()
    getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel("sos_loc", "Emergency location", NotificationManager.IMPORTANCE_LOW))
    getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel("sos_mic", "Emergency audio", NotificationManager.IMPORTANCE_LOW))
  }
}
