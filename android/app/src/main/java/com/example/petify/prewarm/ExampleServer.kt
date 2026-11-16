package com.example.petify.prewarm

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

/**
 * Server mode: calls to the example server in ../server (see server/README.md).
 *
 * The server holds the Secret key and calls the Petify Server API; the app holds only
 * a Client key and the server's token. In production your own backend plays this part.
 */
object ExampleServer {
    private const val JSON_TIMEOUT_MS = 15_000
    private const val UPLOAD_TIMEOUT_MS = 60_000

    /** A server error, shown as "HTTP <status> <code>: <message>". */
    class Failure(status: Int, code: String, message: String) : Exception("HTTP $status $code: $message")

    sealed interface Outcome {
        data class Registered(val status: String, val petId: String?) : Outcome
        data class Identified(val status: String, val candidates: List<Candidate>) : Outcome
        /** [isVerified] and [score] are null when the job did not succeed. */
        data class Verified(val status: String, val petId: String, val isVerified: Boolean?, val score: Int?) : Outcome
    }

    /** [score] is 0–100; [isMatch] is Petify's verdict for this candidate. */
    data class Candidate(val petId: String, val score: Int, val isMatch: Boolean)

    /** A pet this example registered, for the verify list on Home. */
    data class Pet(val petId: String, val createdAt: String)

    /**
     * Registration sessions whose pet the server created and nothing has been
     * registered to yet. [abandonOpenRegistrations] deletes those pets.
     */
    private val openRegistrations = ConcurrentHashMap.newKeySet<UUID>()

    /** GET /pets: the pets this example registered, newest first (at most 20). */
    suspend fun listPets(): List<Pet> = withContext(Dispatchers.IO) {
        val list = JSONObject(call("GET", "pets", JSON_TIMEOUT_MS)).getJSONArray("pets")
        List(list.length()) { i ->
            val pet = list.getJSONObject(i)
            Pet(pet.getString("petId"), pet.optString("createdAt"))
        }
    }

    /** [petId] is the pet to verify; only for [Purpose.VERIFY]. */
    suspend fun createSession(purpose: Purpose, petId: String? = null): UUID {
        // A guide screen shown again asks for a new session; drop the one from before.
        abandonOpenRegistrations()
        // NonCancellable: for a registration the server may already have created a pet
        // when the guide screen leaves, and its session ID must be kept so the pet can be deleted.
        return withContext(Dispatchers.IO + NonCancellable) {
            // Dog only. For cats, send "CAT" here and use PetSpecies.CAT in CameraScreen.
            val body = JSONObject().put("purpose", purpose.wire).put("species", "DOG")
            if (purpose == Purpose.VERIFY) body.put("petId", petId)
            val response = call("POST", "sessions", JSON_TIMEOUT_MS, body.toString().toByteArray(), "application/json")
            val id = UUID.fromString(JSONObject(response).getString("sessionId"))
            if (purpose == Purpose.REGISTER) openRegistrations += id
            id
        }
    }

    /** Uploads one image (multipart field `file`) to /fingerprints or /appearances. */
    suspend fun upload(file: File, kind: String, session: UUID) = withContext(Dispatchers.IO) {
        val boundary = "Boundary-${UUID.randomUUID()}"
        val body = ByteArrayOutputStream().apply {
            write("--$boundary\r\n".toByteArray())
            write("Content-Disposition: form-data; name=\"file\"; filename=\"${file.name}\"\r\n".toByteArray())
            write("Content-Type: image/jpeg\r\n\r\n".toByteArray())
            write(file.readBytes())
            write("\r\n--$boundary--\r\n".toByteArray())
        }.toByteArray()
        call("POST", "sessions/$session/$kind", UPLOAD_TIMEOUT_MS, body, "multipart/form-data; boundary=$boundary")
        Unit
    }

    /**
     * POST /register, /verify or /identify. The server polls Petify's job for up to 30 s
     * before it answers, so this waits longer than the 15 s of the other JSON calls.
     */
    suspend fun finish(session: CaptureSession): Outcome = withContext(Dispatchers.IO) {
        val json = JSONObject(
            call("POST", "sessions/${session.id}/${session.purpose.wire}", UPLOAD_TIMEOUT_MS, "{}".toByteArray(), "application/json"),
        )
        val status = json.getString("status")
        when (session.purpose) {
            Purpose.REGISTER -> {
                if (status == "SUCCESS") openRegistrations -= session.id
                Outcome.Registered(status, json.optString("petId").ifEmpty { null })
            }
            Purpose.VERIFY -> Outcome.Verified(
                status,
                json.optString("petId").ifEmpty { session.petId.orEmpty() },
                if (json.isNull("isVerified")) null else json.getBoolean("isVerified"),
                if (json.isNull("score")) null else json.getInt("score"),
            )
            Purpose.IDENTIFY -> {
                val list = json.optJSONArray("candidates")
                Outcome.Identified(status, List(list?.length() ?: 0) { i ->
                    val c = list!!.getJSONObject(i)
                    Candidate(c.getString("petId"), c.getInt("score"), c.optBoolean("isMatch"))
                })
            }
        }
    }

    /**
     * The user left a registration without a successful register: DELETE each session
     * so the server deletes the pet it created. Fire and forget, on a thread of its own
     * so it outlives the screen that left.
     */
    fun abandonOpenRegistrations() {
        val ids = openRegistrations.toList()
        openRegistrations.removeAll(ids.toSet())
        if (ids.isEmpty()) return
        thread { ids.forEach { runCatching { call("DELETE", "sessions/$it", JSON_TIMEOUT_MS) } } }
    }

    private fun call(method: String, path: String, timeoutMs: Int, body: ByteArray? = null, contentType: String? = null): String {
        // Only called in server mode, where both values are set.
        val connection = URL("${AppConfig.serverUrl}/$path").openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            connection.requestMethod = method
            connection.setRequestProperty("Authorization", "Bearer ${AppConfig.serverToken}")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", contentType)
                // A fixed length sends a Content-Length, not chunks: Petify rejects some chunked uploads.
                connection.setFixedLengthStreamingMode(body.size)
                connection.outputStream.use { it.write(body) }
            }
            val status = connection.responseCode
            val ok = status in 200..299
            val text = (if (ok) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (!ok) {
                val json = runCatching { JSONObject(text) }.getOrNull()
                throw Failure(
                    status,
                    json?.optString("error")?.ifEmpty { null } ?: "error",
                    json?.optString("message")?.ifEmpty { null } ?: connection.responseMessage.orEmpty(),
                )
            }
            return text
        } finally {
            connection.disconnect()
        }
    }
}
