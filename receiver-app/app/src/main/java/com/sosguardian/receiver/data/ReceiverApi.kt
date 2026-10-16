package com.sosguardian.receiver.data

import retrofit2.http.*

interface ReceiverApi {
  @POST("v1/auth/login") suspend fun login(@Body b: Map<String, String>): Map<String, Any>
  @GET("v1/sessions/{id}") suspend fun session(@Path("id") id: String): Map<String, Any>
  @POST("v1/sessions/{id}/ack") suspend fun ack(@Path("id") id: String): Map<String, Any>
  @GET("v1/signaling/ice-servers") suspend fun ice(): Map<String, List<Map<String, Any>>>
}
