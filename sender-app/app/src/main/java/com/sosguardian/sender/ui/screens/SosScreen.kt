package com.sosguardian.sender.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.sosguardian.sender.ui.vm.SosViewModel
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import kotlinx.coroutines.*

// Main SOS screen (spec §5): large red button, press-and-hold ~1s, no extra confirm, readiness indicator.
@Composable
fun SosScreen(vm: SosViewModel, onEmergency: () -> Unit) {
  val status by vm.status.collectAsState()
  val msg by vm.msg.collectAsState()
  var holding by remember { mutableStateOf(false) }
  val scope = rememberCoroutineScope()

  LaunchedEffect(Unit) { vm.loadContacts() }

  Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    Text("SOS Guardian", style = MaterialTheme.typography.headlineMedium)
    Spacer(Modifier.height(8.dp))
    // Readiness: GPS / Network / Audio (real permission states passed from MainActivity in prod)
    Text("GPS: ${status.gps}  NET: ${status.network}  MIC: ${status.audio}", style = MaterialTheme.typography.bodySmall)
    Spacer(Modifier.height(24.dp))
    Button(
      onClick = {},
      modifier = Modifier.size(220.dp).pointerInput(Unit) {
        detectTapGestures(onPress = {
          holding = true
          val job = scope.launch { delay(1000); vm.activate(onEmergency) }
          tryAwaitRelease()
          holding = false
          job.cancel()
        })
      },
      colors = ButtonDefaults.buttonColors(containerColor = if (holding) Color.DarkGray else Color.Red)
    ) { Text(if (holding) "HOLD…" else "SOS", style = MaterialTheme.typography.displayMedium, color = Color.White) }
    Text("Press and hold 1s to activate", style = MaterialTheme.typography.bodyMedium)
    msg?.let { Text(it, color = Color.Red); LaunchedEffect(it) { delay(3000); vm.clearMsg() } }
    Spacer(Modifier.height(16.dp))
    ContactSelector(vm)
  }
}

@Composable
fun ContactSelector(vm: SosViewModel) {
  val contacts by vm.contacts.collectAsState()
  Column {
    Text("Trusted contacts (${contacts.count { it.selected }} selected)", style = MaterialTheme.typography.titleMedium)
    contacts.forEach { c ->
      Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = c.selected, onCheckedChange = { vm.toggleContact(c.id) })
        Text("${c.display_name} ${if (c.verified) "✓" else "(unverified)"}")
      }
    }
  }
}
