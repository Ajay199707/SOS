package com.sosguardian.sender.util

import kotlinx.coroutines.delay
import java.util.UUID
import kotlin.math.pow
import kotlin.random.Random

fun idempotencyKey() = UUID.randomUUID().toString()

// Bounded retries with exponential backoff + jitter (spec §11)
suspend fun <T> retryIO(maxAttempts: Int = 5, baseMs: Long = 500, block: suspend () -> T): T {
  var attempt = 0
  var last: Throwable? = null
  while (attempt < maxAttempts) {
    try { return block() } catch (t: Throwable) { last = t }
    attempt++
    if (attempt >= maxAttempts) break
    val backoff = (baseMs * 2.0.pow(attempt - 1)).toLong() + Random.nextLong(0, 250)
    delay(backoff)
  }
  throw last ?: IllegalStateException("retry failed")
}
