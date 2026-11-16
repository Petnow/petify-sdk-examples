package com.example.petify.prewarm

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.petnow.ui.CameraController
import kotlinx.coroutines.CancellationException

/**
 * The screen before the camera: the user reads it for a few seconds, which is
 * exactly the time prewarm needs.
 */
@Composable
fun GuideScreen(purpose: Purpose, petId: String?, onOpenCamera: (CaptureSession) -> Unit) {
    val context = LocalContext.current
    var session by remember { mutableStateOf<Result<CaptureSession>?>(null) }
    // "Try again" bumps this to request a capture session once more.
    var attempt by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        // ① Prewarm here, on the screen whose button leads to the camera. It validates
        //    the licence, fetches the SDK Profile, picks the inference tier and builds the
        //    detector engine in the background, so the camera screen only opens the camera.
        //    Fire and forget: it returns at once and never throws. No species — an engine
        //    prepared without one serves whichever camera opens.
        AppConfig.license?.let { CameraController.prewarm(context, it) }
    }

    LaunchedEffect(attempt) {
        session = null
        // Camera-only mode asks Petify for one itself; server mode asks the example server.
        // Not runCatching: it would also catch the CancellationException that stops
        // this coroutine when the screen leaves.
        session = try {
            Result.success(CaptureSession.create(purpose, petId))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(Petify.appBg).safeDrawingPadding().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.padding(horizontal = 4.dp, vertical = 8.dp)) {
            Text(purpose.title, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Petify.ink)
            petId?.let { Text("Pet ${it.take(8)}…", fontSize = 14.sp, color = Petify.inkMuted) }
        }
        PetifyCard(title = "Before you start") {
            Text("• Get close enough that the nose fills the frame.")
            Text("• Use soft, even light and avoid glare on the nose.")
            Text("• Hold still until the progress is complete.")
        }
        Spacer(Modifier.weight(1f))
        val current = session
        when {
            current == null -> Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
                Text("Creating a capture session…", color = Petify.inkMuted)
            }
            current.isSuccess -> PrimaryButton("Open camera", onClick = { onOpenCamera(current.getOrThrow()) })
            else -> Column(
                Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Could not create a capture session: ${current.exceptionOrNull()?.message}",
                    color = Petify.error,
                )
                PrimaryButton("Try again", onClick = { attempt++ })
            }
        }
    }
}
