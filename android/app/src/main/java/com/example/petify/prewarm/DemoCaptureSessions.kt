package com.example.petify.prewarm

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * EXAMPLE ONLY — do not ship this.
 *
 * In a real integration your **server** creates the capture session with the
 * Petify Server API and hands the app nothing but its ID. The app should never
 * need to call this endpoint. It is here so the example runs without a backend.
 *
 * The session is for identification so that running the example does not
 * create pets in your account.
 */
object DemoCaptureSessions {
    suspend fun create(): UUID = withContext(Dispatchers.IO) {
        val apiKey = AppConfig.apiKey ?: error("petnow.apiKey is not set")
        val connection = URL("https://api.petify.petnow.io/v2/capture-sessions")
            .openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.setRequestProperty("x-petnow-api-key", apiKey)
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use {
                it.write("""{"species":"DOG","purpose":"PET_IDENTIFICATION"}""".toByteArray())
            }
            val status = connection.responseCode
            check(status == 201) { "Petify API returned HTTP $status. Check petnow.apiKey." }
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            UUID.fromString(JSONObject(body).getJSONObject("data").getString("id"))
        } finally {
            connection.disconnect()
        }
    }
}
