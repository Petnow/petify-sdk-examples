package com.example.petify.prewarm

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import io.petnow.ui.CameraController
import java.util.UUID

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Draw behind the system bars; the screens keep clear of them with safeDrawingPadding().
        enableEdgeToEdge()
        setContent { MaterialTheme { App() } }
    }
}

sealed interface Route {
    data object Home : Route
    data object Guide : Route
    data class Camera(val captureSessionId: UUID) : Route
    data class Result(val summary: CaptureSummary) : Route
}

@Composable
private fun App() {
    val backStack = remember { mutableStateListOf<Route>(Route.Home) }
    val atHome = backStack.size == 1
    val goHome = { backStack.removeRange(1, backStack.size) }

    BackHandler(enabled = !atHome) {
        // Back from the result goes home, like Done (iOS hides Back there).
        if (backStack.last() is Route.Result) goHome() else backStack.removeAt(backStack.lastIndex)
    }

    // ④ Release what prewarm prepared only when the user leaves the capture flow.
    //    Not when the guide screen goes away: that also happens on the way *into* the
    //    camera, and releasing there destroys the engine the camera is about to take.
    //    Releasing is optional — the SDK also lets go when the system trims memory.
    LaunchedEffect(atHome) {
        if (atHome) CameraController.releasePrewarmed()
    }

    when (val route = backStack.last()) {
        Route.Home -> HomeScreen(onStart = { backStack.add(Route.Guide) })
        Route.Guide -> GuideScreen(onOpenCamera = { backStack.add(Route.Camera(it)) })
        is Route.Camera -> CameraScreen(
            captureSessionId = route.captureSessionId,
            // The result replaces the camera: its capture session is used up, so
            // nothing should lead back to it.
            onCaptured = { backStack[backStack.lastIndex] = Route.Result(it) },
            onClose = { backStack.removeAt(backStack.lastIndex) },
        )
        is Route.Result -> ResultScreen(
            summary = route.summary,
            onDone = goHome,
        )
    }
}
