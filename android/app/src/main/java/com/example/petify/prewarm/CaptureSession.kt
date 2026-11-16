package com.example.petify.prewarm

import android.os.Parcelable
import io.petnow.ui.config.DetectionPurpose
import kotlinx.parcelize.Parcelize
import java.util.UUID

/** What the user picked on Home. [wire] is the example server's `purpose`. */
enum class Purpose(val wire: String, val detection: DetectionPurpose, val title: String) {
    IDENTIFY("identify", DetectionPurpose.PET_IDENTIFICATION, "Identify a pet"),
    REGISTER("register", DetectionPurpose.PET_PROFILE_REGISTRATION, "Register a pet"),
    VERIFY("verify", DetectionPurpose.PET_VERIFICATION, "Verify a pet"),
}

/** The capture session the camera writes into, what it is for, and the pet to verify. */
@Parcelize // saved with the back stack (MainActivity.kt)
data class CaptureSession(val id: UUID, val purpose: Purpose, val petId: String? = null) : Parcelable {
    companion object {
        /**
         * Camera-only mode: the app creates an identification session itself.
         * Server mode: the example server creates it (for a registration, after the pet;
         * for a verification, for the pet [petId]).
         */
        suspend fun create(purpose: Purpose, petId: String? = null): CaptureSession {
            val id = if (AppConfig.isServerMode) {
                ExampleServer.createSession(purpose, petId)
            } else {
                check(purpose == Purpose.IDENTIFY) { "Home offers registration and verification only in server mode" }
                DemoCaptureSessions.create()
            }
            return CaptureSession(id, purpose, petId)
        }
    }
}
