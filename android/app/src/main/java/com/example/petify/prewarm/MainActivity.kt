package com.example.petify.prewarm

import android.os.Bundle
import android.os.Parcelable
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.toMutableStateList
import io.petnow.ui.CameraController
import kotlinx.parcelize.Parcelize

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Draw behind the system bars; the screens keep clear of them with safeDrawingPadding().
        // Dark bar icons: the screens are light even in dark mode (PetifyTheme).
        val lightBars = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
        enableEdgeToEdge(statusBarStyle = lightBars, navigationBarStyle = lightBars)
        setContent { PetifyTheme { App() } }
    }
}

// Parcelable so the back stack survives the activity being recreated (see App()).
sealed interface Route : Parcelable {
    @Parcelize data object Home : Route
    /** [petId] is the pet to verify, for [Purpose.VERIFY]. */
    @Parcelize data class Guide(val purpose: Purpose, val petId: String? = null) : Route
    @Parcelize data class Camera(val session: CaptureSession) : Route
    @Parcelize data class Result(val session: CaptureSession, val summary: CaptureSummary) : Route
}

@Composable
private fun App() {
    // rememberSaveable, not remember: dark mode, font size, locale or a window resize
    // recreates the activity, and a plain remember would drop the user back home
    // mid-flow (and run the release below).
    val backStack = rememberSaveable(
        saver = listSaver(save = { it.toList() }, restore = { it.toMutableStateList() }),
    ) { mutableStateListOf<Route>(Route.Home) }
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
        if (!atHome) return@LaunchedEffect
        CameraController.releasePrewarmed()
        // Server mode: back home from a registration that did not register (Back, Close,
        // Done before Send, or a failed register) — delete the pet the server created for it.
        ExampleServer.abandonOpenRegistrations()
    }

    when (val route = backStack.last()) {
        Route.Home -> HomeScreen(onStart = { purpose, petId -> backStack.add(Route.Guide(purpose, petId)) })
        is Route.Guide -> GuideScreen(route.purpose, route.petId, onOpenCamera = { backStack.add(Route.Camera(it)) })
        is Route.Camera -> CameraScreen(
            session = route.session,
            // The result replaces the camera: its capture session is used up, so
            // nothing should lead back to it.
            onCaptured = {
                // Only if the camera is still on top: a late callback must not replace another screen.
                if (backStack.last() is Route.Camera) backStack[backStack.lastIndex] = Route.Result(route.session, it)
            },
            onClose = { backStack.removeAt(backStack.lastIndex) },
        )
        is Route.Result -> ResultScreen(
            session = route.session,
            summary = route.summary,
            onDone = goHome,
        )
    }
}
