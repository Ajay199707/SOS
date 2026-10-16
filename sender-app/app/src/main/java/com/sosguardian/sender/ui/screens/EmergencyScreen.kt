package com.sosguardian.sender.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.sosguardian.sender.ui.vm.SosViewModel

// Persistent Emergency Mode (spec §9): status, prevent accidental nav, clear cancel control.
@Composable
fun EmergencyScreen(vm: SosViewModel, sessionId: String, onResolved: () -> Unit) {
  val status by vm.status.collectAsState()
  var confirm by remember { mutableStateOf(false) }
  Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    Text("EMERGENCY ACTIVE", color = Color.Red, style = MaterialTheme.typography.headlineMedium)
    Text("Session ${sessionId.take(8)}…", style = MaterialTheme.typography.bodySmall)
    Spacer(Modifier.height(12.dp))
    Text("Alerts: ${status.notify}")
    Text("GPS: ${status.gps}")
    Text("Audio: ${status.audio}")
    Spacer(Modifier.height(24.dp))
    if (!confirm) {
      Button(onClick = { confirm = true }, colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)) {
        Text("End emergency")
      }
    } else {
      Text("End sharing and notify contacts?")
      Row {
        Button(onClick = { vm.cancel(); onResolved() }) { Text("Confirm end") }
        Spacer(Modifier.width(12.dp))
        OutlinedButton(onClick = { confirm = false }) { Text("Keep active") }
      }
    }
  }
}
