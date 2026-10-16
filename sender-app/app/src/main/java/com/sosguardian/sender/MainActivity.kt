package com.sosguardian.sender

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sosguardian.sender.ui.screens.EmergencyScreen
import com.sosguardian.sender.ui.screens.SosScreen
import com.sosguardian.sender.ui.vm.SosViewModel

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // NOTE: request FINE/COARSE/BACKGROUND location + RECORD_AUDIO + POST_NOTIFICATIONS
    // during onboarding (see docs/PERMISSIONS.md) before SOS can work in background.
    setContent {
      MaterialTheme {
        val vm: SosViewModel = viewModel()
        var emergencyId by remember { mutableStateOf<String?>(null) }
        val sid by vm.sessionId.collectAsState()
        LaunchedEffect(sid) { if (sid == null) emergencyId = null }
        if (emergencyId != null) EmergencyScreen(vm, emergencyId!!, onResolved = { emergencyId = null })
        else SosScreen(vm, onEmergency = { emergencyId = vm.sessionId.value })
      }
    }
  }
}
