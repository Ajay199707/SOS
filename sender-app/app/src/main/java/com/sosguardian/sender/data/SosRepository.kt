package com.sosguardian.sender.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

private val Context.ds by preferencesDataStore("sos")
private val KEY_TOKEN = stringPreferencesKey("access")
private val KEY_REFRESH = stringPreferencesKey("refresh")
private val KEY_BASE = stringPreferencesKey("base_url")

class SosRepository(private val ctx: Context) {
  private val moshi = Moshi.Builder().build()

  suspend fun baseUrl(): String =
    ctx.ds.data.map { it[KEY_BASE] ?: "http://10.0.2.2:4000/" }.first()

  suspend fun setBaseUrl(v: String) { ctx.ds.edit { it[KEY_BASE] = v } }
  suspend fun saveTokens(a: String, r: String) { ctx.ds.edit { it[KEY_TOKEN] = a; it[KEY_REFRESH] = r } }
  suspend fun access(): String? = ctx.ds.data.map { it[KEY_TOKEN] }.first()
  suspend fun clear() { ctx.ds.edit { it.remove(KEY_TOKEN); it.remove(KEY_REFRESH) } }

  suspend fun api(): SosApi {
    val auth = Interceptor { chain ->
      val token = kotlinx.coroutines.runBlocking { access() }
      val req = if (token != null) chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build()
      else chain.request()
      chain.proceed(req)
    }
    val client = OkHttpClient.Builder()
      .addInterceptor(auth)
      .addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC))
      .build()
    return Retrofit.Builder()
      .baseUrl(baseUrl())
      .client(client)
      .addConverterFactory(MoshiConverterFactory.create(moshi))
      .build().create(SosApi::class.java)
  }
}
