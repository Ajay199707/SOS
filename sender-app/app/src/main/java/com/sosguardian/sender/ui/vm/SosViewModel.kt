package com.sosguardian.sender.ui.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sosguardian.sender.data.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class SosViewModel(app: Application) : AndroidViewModel(app) {
  private val repo = SosRepository(app)
  val manager = SessionManager(app, repo)
  val sessionId = manager.sessionId
  val status = manager.status

  private val _contacts = MutableStateFlow<List<Contact>>(emptyList())
  val contacts: StateFlow<List<Contact>> = _contacts
  private val _msg = MutableStateFlow<String?>(null)
  val msg: StateFlow<String?> = _msg
  var readiness: Triple<Boolean, Boolean, Boolean> = Triple(false, false, false) // gps, net, mic

  fun loadContacts() = viewModelScope.launch {
    try { _contacts.value = repo.api().contacts() } catch (t: Throwable) { _msg.value = t.message }
  }

  fun toggleContact(id: String?) {
    _contacts.value = _contacts.value.map { if (it.id == id) it.copy(selected = !it.selected) else it }
  }

  fun activate(onEmergency: () -> Unit) {
    val ids = _contacts.value.filter { it.selected }.mapNotNull { it.id }
    if (ids.isEmpty()) { _msg.value = "Select at least one trusted contact"; return }
    manager.activate(ids, onDone = { onEmergency() }, onError = { _msg.value = it })
  }

  fun cancel() = manager.cancel()
  fun clearMsg() { _msg.value = null }
}
