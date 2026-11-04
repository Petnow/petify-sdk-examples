package com.example.petify.prewarm

import android.graphics.BitmapFactory
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import java.io.File

data class CaptureSummary(
    val fingerprintImages: List<File>,
    val appearanceImageCount: Int,
    val engineReused: Boolean,
    val firstFrameMs: Long?,
)

@Composable
fun ResultScreen(summary: CaptureSummary, onDone: () -> Unit) {
    val preview = remember(summary) {
        summary.fingerprintImages.firstOrNull()?.let { BitmapFactory.decodeFile(it.path) }
    }
    Column(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Result", style = MaterialTheme.typography.headlineSmall)
        Text("Nose images: ${summary.fingerprintImages.size}")
        Text("Appearance images: ${summary.appearanceImageCount}")
        Text("Models were ready: ${if (summary.engineReused) "Yes — prewarm took" else "No"}")
        summary.firstFrameMs?.let { Text("First processed frame: $it ms") }
        Text(
            "Upload the images to your server, which sends them to Petify with the capture session ID.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        preview?.let {
            Image(it.asImageBitmap(), contentDescription = "First nose image", Modifier.heightIn(max = 200.dp))
        }
        Spacer(Modifier.weight(1f))
        Button(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text("Done") }
    }
}
