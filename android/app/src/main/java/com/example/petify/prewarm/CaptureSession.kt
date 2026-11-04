package com.example.petify.prewarm

import android.os.Parcelable
import io.petnow.ui.config.DetectionPurpose
import kotlinx.parcelize.Parcelize
import java.util.UUID

/** What the user picked on Home. [wire] is the example server's `purpose`. */
enum class Purpose(val wire: String, val detection: DetectionPurpose) {
    IDENTIFY("identify", DetectionPurpose.PET_IDENTIFICATION),
    REGISTER("register", DetectionPurpose.PET_PROFILE_REGISTRATION),
}

/** The capture session the camera writes into, and what it is for. */
@Parcelize // saved with the back stack (MainActivity.kt)
data class CaptureSession(val id: UUID, val purpose: Purpose) : Parcelable {
    companion object {
        /**
         * Camera-only mode: the app creates an identification session itself.
         * Server mode: the example server creates it (for a registration, after the pet).
         */
        suspend fun create(purpose: Purpose): CaptureSession {
            val id = if (AppConfig.isServerMode) {
                ExampleServer.createSession(purpose)
            } else {
                check(purpose == Purpose.IDENTIFY) { "Home offers registration only in server mode" }
                DemoCaptureSessions.create()
            }
            return CaptureSession(id, purpose)
        }
    }
}
