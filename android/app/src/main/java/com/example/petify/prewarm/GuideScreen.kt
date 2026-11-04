package com.example.petify.prewarm

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import io.petnow.ui.CameraController
import java.util.UUID

/**
 * The screen before the camera: the user reads it for a few seconds, which is
 * exactly the time prewarm needs.
 */
@Composable
fun GuideScreen(onOpenCamera: (UUID) -> Unit) {
    val context = LocalContext.current
    var session by remember { mutableStateOf<Result<UUID>?>(null) }

    LaunchedEffect(Unit) {
        // ① Prewarm here, on the screen whose button leads to the camera. It validates
        //    the licence, fetches the SDK Profile, picks the inference tier and builds the
        //    detector engine in the background, so the camera screen only opens the camera.
        //    Fire and forget: it returns at once and never throws. No species — an engine
        //    prepared without one serves whichever camera opens.
        AppConfig.license?.let { CameraController.prewarm(context, it) }

        // Your server issues the capture session; this example asks for one itself.
        session = runCatching { DemoCaptureSessions.create() }
    }

    Column(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Before you start", style = MaterialTheme.typography.headlineSmall)
        Text("• Get close enough that the nose fills the frame.")
        Text("• Use soft, even light and avoid glare on the nose.")
        Text("• Hold still until the progress is complete.")
        Spacer(Modifier.weight(1f))
        val current = session
        when {
            current == null -> Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
                Text("Creating a capture session…")
            }
            current.isSuccess -> Button(
                onClick = { onOpenCamera(current.getOrThrow()) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Open camera") }
            else -> Text(
                "Could not create a capture session: ${current.exceptionOrNull()?.message}",
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
