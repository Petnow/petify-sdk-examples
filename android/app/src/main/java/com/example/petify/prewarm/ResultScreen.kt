package com.example.petify.prewarm

import android.graphics.BitmapFactory
import android.os.Parcelable
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

/** What Send ended with, as shown. Saved, so a recreated activity shows it rather than offering Send again. */
@Parcelize
private data class Shown(val title: String, val lines: List<String>, val tone: Tone, val note: String? = null) : Parcelable

private enum class Tone { SUCCESS, ERROR, NEUTRAL }

@Composable
fun ResultScreen(session: CaptureSession, summary: CaptureSummary, onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    val preview = remember(summary) {
        summary.fingerprintImages.firstOrNull()?.let { BitmapFactory.decodeFile(it.path) }
    }
    var progress by remember { mutableStateOf<String?>(null) } // non-null while sending
    var outcome by rememberSaveable { mutableStateOf<Shown?>(null) }

    // Uploads every image to the capture session, then registers, verifies or identifies.
    // One try: after an outcome or an error, Done returns home and a new capture starts over.
    fun send() = scope.launch {
        try {
            val uploads = summary.fingerprintImages.map { it to "fingerprints" } +
                summary.appearanceImages.map { it to "appearances" }
            uploads.forEachIndexed { index, (file, kind) ->
                progress = "Uploading ${index + 1} of ${uploads.size}…"
                ExampleServer.upload(file, kind, session.id)
            }
            progress = when (session.purpose) {
                Purpose.REGISTER -> "Registering…"
                Purpose.VERIFY -> "Verifying…"
                Purpose.IDENTIFY -> "Identifying…"
            }
            outcome = describe(ExampleServer.finish(session))
        } catch (e: CancellationException) {
            throw e // the screen left
        } catch (e: Exception) {
            outcome = Shown("Request failed", listOf(e.message ?: e.toString()), Tone.ERROR)
        } finally {
            progress = null
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Petify.appBg)
            .safeDrawingPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Result",
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                color = Petify.ink,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp),
            )
            PetifyCard(title = session.purpose.title) {
                Text("Nose images: ${summary.fingerprintImages.size}")
                Text("Appearance images: ${summary.appearanceImages.size}")
                Text("Engine ready at camera start: ${if (summary.engineReused) "Yes" else "No"}")
                summary.firstFrameMs?.let { Text("First processed frame: $it ms") }
                preview?.let {
                    Image(it.asImageBitmap(), contentDescription = "First nose image", Modifier.heightIn(max = 200.dp))
                }
            }
            if (!AppConfig.isServerMode) {
                Text(
                    "Run the example server to register or identify these images (server/README)",
                    fontSize = 13.sp,
                    color = Petify.inkMuted,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            } else outcome?.let { OutcomeCard(it) }
        }
        if (AppConfig.isServerMode && outcome == null) {
            SecondaryButton(progress ?: "Send", onClick = { send() }, enabled = progress == null)
        }
        // Leaving a registration without a successful register deletes its pet (MainActivity.kt).
        PrimaryButton("Done", onClick = onDone, enabled = progress == null)
    }
}

@Composable
private fun OutcomeCard(shown: Shown) {
    val color = when (shown.tone) {
        Tone.SUCCESS -> Petify.success
        Tone.ERROR -> Petify.error
        Tone.NEUTRAL -> Petify.ink
    }
    PetifyCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (shown.tone != Tone.NEUTRAL) {
                Icon(
                    if (shown.tone == Tone.SUCCESS) Icons.Filled.CheckCircle else Icons.Filled.Cancel,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(28.dp),
                )
                Spacer(Modifier.width(8.dp))
            }
            Text(shown.title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = color)
        }
        shown.lines.forEach { Text(it, color = Petify.ink) }
        shown.note?.let { Text(it, fontSize = 13.sp, color = Petify.inkMuted) }
    }
}

private fun describe(outcome: ExampleServer.Outcome): Shown = when (outcome) {
    is ExampleServer.Outcome.Registered -> Shown(
        "Registration: ${outcome.status}",
        listOfNotNull(outcome.petId?.let { "Pet ID: $it" }),
        if (outcome.status == "SUCCESS") Tone.SUCCESS else Tone.ERROR,
    )
    is ExampleServer.Outcome.Verified -> when (outcome.isVerified) {
        null -> Shown("Verification ${outcome.status}", listOf("petId ${outcome.petId}"), Tone.ERROR)
        else -> Shown(
            if (outcome.isVerified) "Same pet" else "Not the same pet",
            listOf("petId ${outcome.petId}", "score ${outcome.score ?: "—"}"),
            if (outcome.isVerified) Tone.SUCCESS else Tone.ERROR,
            note = "The server's decision is the answer, not the score.",
        )
    }
    is ExampleServer.Outcome.Identified -> Shown(
        "Identification: ${outcome.status}",
        outcome.candidates.take(3)
            .map { "${it.petId} · ${it.score}" + if (it.isMatch) "  ✓ match" else "" }
            .ifEmpty { listOf("No matching pet") },
        when {
            outcome.status != "SUCCESS" -> Tone.ERROR
            outcome.candidates.any { it.isMatch } -> Tone.SUCCESS
            else -> Tone.NEUTRAL
        },
    )
}
