package com.example.petify.prewarm

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import io.petnow.callback.PetnowCameraDetectionListenerV2
import io.petnow.ui.CameraController
import io.petnow.ui.CameraResult
import io.petnow.ui.CameraView
import io.petnow.ui.config.DetectionConfiguration
import io.petnow.ui.config.PetSpecies
import io.petnow.ui.status.DetectionFailureReason
import io.petnow.ui.status.DetectionStatus
import kotlinx.coroutines.CancellationException

@Composable
fun CameraScreen(
    session: CaptureSession,
    onCaptured: (CaptureSummary) -> Unit,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // The listener below is set once; read the latest callback, not the one from the first composition.
    val currentOnCaptured by rememberUpdatedState(onCaptured)
    // HomeScreen does not start the flow without a key.
    val controller = remember { CameraController(context.applicationContext, AppConfig.license!!, scope) }
    val state by controller.state.collectAsState()
    val stats by controller.performanceStats.collectAsState()
    var status by remember { mutableStateOf<DetectionStatus>(DetectionStatus.NoObject) }
    var showRetry by remember { mutableStateOf(false) }
    var startError by remember { mutableStateOf<String?>(null) }
    var permissionDenied by remember { mutableStateOf(false) }

    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasPermission = granted
        if (!granted) permissionDenied = true
    }

    DisposableEffect(controller) {
        controller.setDetectionListenerV2(object : PetnowCameraDetectionListenerV2 {
            override fun onDetectionStatus(primaryDetectionStatus: DetectionStatus) {
                status = primaryDetectionStatus
            }

            override fun onDetectionProgress(progress: Int) = Unit // read from controller.state

            override fun onDetectionFinished(result: CameraResult) {
                when (result) {
                    is CameraResult.Success -> {
                        val phases = controller.performanceStats.value.phases
                        currentOnCaptured(
                            CaptureSummary(
                                fingerprintImages = result.fingerprintImageFiles,
                                appearanceImages = result.appearanceImageFiles,
                                // ⑤ engineReused: the engine was already built when the camera started —
                                //    true after a finished prewarm or when an earlier camera left one;
                                //    false when this camera built it (on iOS, also when it joined a
                                //    prewarm still building).
                                engineReused = phases.engineReused ?: false,
                                firstFrameMs = phases.firstFrameAtMs,
                            ),
                        )
                    }
                    CameraResult.Fail -> showRetry = true
                }
            }
        })
        // The screen owns the controller. release() closes the camera and hands the
        // engine back to the SDK, so the next camera in this process opens on it too.
        onDispose { controller.release() }
    }

    LaunchedEffect(hasPermission) {
        // CameraView does not ask for the permission; the host does.
        if (!hasPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
            return@LaunchedEffect
        }
        try {
            controller.initializeCamera(
                // Dog only. For cats, use PetSpecies.CAT here and send "CAT" when the session is created.
                DetectionConfiguration(species = PetSpecies.DOG, purpose = session.purpose.detection),
                session.id,
            )
            // startDetection() reports failure in its Result rather than throwing.
            controller.startDetection().onFailure { startError = it.message ?: it.toString() }
        } catch (e: CancellationException) {
            throw e // the screen left; nothing to report
        } catch (e: Exception) {
            // An invalid key, a missing permission or a camera that will not open
            // surfaces here — never from prewarm.
            startError = e.message ?: e.toString()
        }
    }

    // ② Guide from detection feedback, not from the preview appearing. Since 1.6.0 the
    //    preview is up before the engine is ready; detectionReadyAtMs marks the moment
    //    detection begins. With a prewarm that is almost immediate.
    val guidance = if (stats.phases.detectionReadyAtMs == null) "Getting ready…" else guidanceFor(status)

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { CameraView(it).apply { this.controller = controller } },
            modifier = Modifier.fillMaxSize(),
        )
        IconButton(
            onClick = onClose,
            modifier = Modifier
                .safeDrawingPadding()
                .padding(8.dp)
                .background(Color.White.copy(alpha = 0.7f), CircleShape),
        ) { Icon(Icons.Filled.Close, contentDescription = "Close camera") }
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .safeDrawingPadding()
                .padding(16.dp)
                .fillMaxWidth()
                .background(Color.White.copy(alpha = 0.85f), RoundedCornerShape(16.dp))
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(guidance, style = MaterialTheme.typography.titleMedium)
            LinearProgressIndicator(
                progress = { state.progressPercent / 100f },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    if (showRetry) {
        AlertDialog(
            onDismissRequest = {},
            title = { Text("Capture failed") },
            confirmButton = {
                // ③ Retry with startDetection(): the camera stays open, so there is no second start.
                TextButton(onClick = {
                    showRetry = false
                    controller.startDetection().onFailure { startError = it.message ?: it.toString() }
                }) { Text("Try again") }
            },
            dismissButton = { TextButton(onClick = onClose) { Text("Leave") } },
        )
    }
    if (permissionDenied) {
        // Once the user has denied it twice, Android stops asking; only the app's
        // settings page can grant it.
        AlertDialog(
            onDismissRequest = onClose,
            title = { Text("Camera permission needed") },
            text = { Text("Allow camera access to scan a nose print.") },
            confirmButton = {
                TextButton(onClick = {
                    context.startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
                    )
                    onClose()
                }) { Text("Open settings") }
            },
            dismissButton = { TextButton(onClick = onClose) { Text("Leave") } },
        )
    }
    startError?.let { message ->
        AlertDialog(
            onDismissRequest = onClose,
            title = { Text("Camera could not start") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = onClose) { Text("OK") } },
        )
    }
}

private fun guidanceFor(status: DetectionStatus): String = when (status) {
    DetectionStatus.NoObject -> "Point the camera at your dog's nose"
    DetectionStatus.Processing, DetectionStatus.Detected -> "Hold still…"
    DetectionStatus.Finished -> "Done"
    is DetectionStatus.Failed -> when (status.reason) {
        DetectionFailureReason.TooClose -> "Move a little farther away"
        DetectionFailureReason.TooFarAway -> "Move a little closer"
        DetectionFailureReason.TooDark -> "Find a brighter spot"
        DetectionFailureReason.TooBright, DetectionFailureReason.GlareDetected -> "Avoid direct light on the nose"
        DetectionFailureReason.TooBlurred,
        DetectionFailureReason.MotionBlurDetected,
        DetectionFailureReason.DefocusedBlurDetected -> "Hold the phone still"
        DetectionFailureReason.ShadowDetected -> "Avoid shadows on the nose"
        else -> "Point the camera straight at the nose"
    }
}
