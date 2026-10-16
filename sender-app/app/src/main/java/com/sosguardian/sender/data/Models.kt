package com.sosguardian.sender.data

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class User(val id: String, val email: String?, val phone: String?, val display_name: String)

@JsonClass(generateAdapter = true)
data class AuthResp(val user: User, val accessToken: String, val refreshToken: String)

@JsonClass(generateAdapter = true)
data class Contact(
  val id: String? = null,
  val display_name: String,
  val phone: String? = null,
  val email: String? = null,
  val relationship: String? = null,
  val notify_push: Boolean = true,
  val notify_sms: Boolean = false,
  val can_access_session: Boolean = true,
  val capability: String = "app",
  val verified: Boolean = false,
  var selected: Boolean = false
)

@JsonClass(generateAdapter = true)
data class Session(val id: String, val state: String, val created_at: String, val deduplicated: Boolean = false)

enum class SessionState { IDLE, ACTIVATING, ACTIVE, DEGRADED, CANCEL_REQUESTED, RESOLVED, FAILED }

data class SubsystemStatus(
  val gps: String = "UNKNOWN",
  val audio: String = "UNKNOWN",
  val network: String = "UNKNOWN",
  val notify: String = "UNKNOWN"
)
