package com.example.petify.prewarm

import android.graphics.BitmapFactory
import android.os.Parcelable
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.parcelize.Parcelize
import java.io.File

@Parcelize // saved with the back stack (MainActivity.kt)
data class CaptureSummary(
    val fingerprintImages: List<File>,
    val appearanceImages: List<File>,
    val engineReused: Boolean,
    val firstFrameMs: Long?,
) : Parcelable

@Composable
fun ResultScreen(session: CaptureSession, summary: CaptureSummary, onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    val preview = remember(summary) {
        summary.fingerprintImages.firstOrNull()?.let { BitmapFactory.decodeFile(it.path) }
    }
    var progress by remember { mutableStateOf<String?>(null) } // non-null while sending
    // Saved, so a recreated activity shows the outcome rather than offering Send again.
    var outcome by rememberSaveable { mutableStateOf<String?>(null) }
    var failed by rememberSaveable { mutableStateOf(false) }

    // Uploads every image to the capture session, then registers or identifies. One try:
    // after an outcome or an error, Done returns home and a new capture starts over.
    fun send() = scope.launch {
        try {
            val uploads = summary.fingerprintImages.map { it to "fingerprints" } +
                summary.appearanceImages.map { it to "appearances" }
            uploads.forEachIndexed { index, (file, kind) ->
                progress = "Uploading ${index + 1} of ${uploads.size}…"
                ExampleServer.upload(file, kind, session.id)
            }
            progress = if (session.purpose == Purpose.REGISTER) "Registering…" else "Identifying…"
            outcome = describe(ExampleServer.finish(session))
        } catch (e: CancellationException) {
            throw e // the screen left
        } catch (e: Exception) {
            failed = true
            outcome = e.message ?: e.toString()
        } finally {
            progress = null
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Result", style = MaterialTheme.typography.headlineSmall)
        Text("Nose images: ${summary.fingerprintImages.size}")
        Text("Appearance images: ${summary.appearanceImages.size}")
        Text("Engine ready at camera start: ${if (summary.engineReused) "Yes" else "No"}")
        summary.firstFrameMs?.let { Text("First processed frame: $it ms") }
        if (!AppConfig.isServerMode) {
            Text(
                "Run the example server to register or identify these images (server/README)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else when (val text = outcome) {
            null -> OutlinedButton(onClick = { send() }, enabled = progress == null, modifier = Modifier.fillMaxWidth()) {
                Text(progress ?: "Send")
            }
            else -> Text(text, color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
        }
        preview?.let {
            Image(it.asImageBitmap(), contentDescription = "First nose image", Modifier.heightIn(max = 200.dp))
        }
        Spacer(Modifier.weight(1f))
        // Leaving a registration without a successful register deletes its pet (MainActivity.kt).
        Button(onClick = onDone, enabled = progress == null, modifier = Modifier.fillMaxWidth()) { Text("Done") }
    }
}

private fun describe(outcome: ExampleServer.Outcome): String = when (outcome) {
    is ExampleServer.Outcome.Registered ->
        "Registration: ${outcome.status}" + (outcome.petId?.let { "\nPet ID: $it" } ?: "")
    is ExampleServer.Outcome.Identified ->
        "Identification: ${outcome.status}\n" + outcome.candidates.take(3)
            .joinToString("\n") { "${it.petId} · ${it.score}" + if (it.isMatch) "  ✓ match" else "" }
            .ifEmpty { "No matching pet" }
}
