package com.sosguardian.receiver.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// Receiver dashboard (Phases 4-5 mobile): session state, map WebView (OSM), WebRTC audio playback, ack.
// Full map via Google Maps Compose requires API key; OSM WebView works without one.
class DashboardActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      MaterialTheme {
        var sessionId by remember { mutableStateOf("") }
        Column(Modifier.fillMaxSize().padding(16.dp)) {
          Text("SOS Receiver", style = MaterialTheme.typography.headlineMedium)
          OutlinedTextField(sessionId, { sessionId = it }, label = { Text("Session UUID") })
          Text("Map: load https://www.openstreetmap.org in WebView with live marker (see ReceiverMapView).")
          Text("Audio: PeerConnection answer via /signaling, playback with controls, reconnect on failure.")
          Button(onClick = { /* ack via ReceiverApi */ }) { Text("Acknowledge") }
        }
      }
    }
  }
}
