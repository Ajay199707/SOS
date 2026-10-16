package com.sosguardian.sender.data

import retrofit2.http.*

interface SosApi {
  @POST("v1/auth/register") suspend fun register(@Body b: Map<String, String?>): AuthResp
  @POST("v1/auth/login") suspend fun login(@Body b: Map<String, String>): AuthResp
  @GET("v1/auth/me") suspend fun me(): User

  @GET("v1/contacts") suspend fun contacts(): List<Contact>
  @POST("v1/contacts") suspend fun addContact(@Body b: Contact): Contact

  @POST("v1/sessions") suspend fun createSession(@Body b: Map<String, Any>): Session
  @POST("v1/sessions/{id}/location") suspend fun postLocation(@Path("id") id: String, @Body b: Map<String, Any?>): Map<String, Boolean>
  @POST("v1/sessions/{id}/state") suspend fun setState(@Path("id") id: String, @Body b: Map<String, String?>): Map<String, Any>
  @POST("v1/sessions/{id}/cancel") suspend fun cancel(@Path("id") id: String): Map<String, Boolean>
  @POST("v1/sessions/{id}/notify") suspend fun notify(@Path("id") id: String): Map<String, Any>

  @GET("v1/signaling/ice-servers") suspend fun iceServers(): Map<String, List<Map<String, Any>>>
  @POST("v1/signaling/{id}/{kind}") suspend fun signal(@Path("id") id: String, @Path("kind") kind: String, @Body b: Map<String, Any?>): Map<String, Boolean>
  @POST("v1/devices") suspend fun registerDevice(@Body b: Map<String, String?>): Map<String, Any>
}
