package com.example.petify.prewarm

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.KeyOff
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.WbSunny
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException

/** [onStart] gets the purpose and, for [Purpose.VERIFY], the pet to verify. */
@Composable
fun HomeScreen(onStart: (Purpose, String?) -> Unit) {
    val canStart = AppConfig.apiKey != null
    Column(Modifier.fillMaxSize().background(Petify.appBg)) {
        Text(
            "Petify",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Petify.ink,
            modifier = Modifier
                .fillMaxWidth()
                .background(Petify.surface)
                .statusBarsPadding()
                .padding(horizontal = 20.dp, vertical = 14.dp),
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (AppConfig.apiKey == null) {
                Notice(Icons.Filled.KeyOff, "Set petnow.apiKey in android/local.properties, then rebuild.")
            }
            if (AppConfig.serverConfigIncomplete) {
                Notice(null, "Set both example.serverUrl and example.serverToken in android/local.properties, then rebuild.")
            }

            PetifyCard(title = "Biometric scan", icon = Icons.Filled.Pets) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ActionCard("Identify\na pet", Icons.Filled.QrCodeScanner, canStart, Modifier.weight(1f)) {
                        onStart(Purpose.IDENTIFY, null)
                    }
                    // Registering creates a pet, which needs the Secret key: only the example server has it.
                    ActionCard("Register\na pet", Icons.Outlined.PhotoCamera, canStart && AppConfig.isServerMode, Modifier.weight(1f)) {
                        onStart(Purpose.REGISTER, null)
                    }
                }
                if (!AppConfig.isServerMode) {
                    Text("Needs the example server (see server/README)", fontSize = 13.sp, color = Petify.inkMuted)
                }
            }

            PetifyCard(title = "Pets", icon = Icons.Filled.Pets) {
                // Listing pets needs the Secret key too, so verify is a server-mode feature.
                if (AppConfig.isServerMode) {
                    PetList(enabled = canStart, onVerify = { onStart(Purpose.VERIFY, it) })
                } else {
                    Text(
                        "Run the example server (server/README) to register and verify pets.",
                        fontSize = 14.sp,
                        color = Petify.inkMuted,
                    )
                }
            }

            PetifyCard(title = "Before you scan", icon = Icons.Outlined.Info) {
                Tip(Icons.Outlined.WbSunny, "Shoot in a bright place.",
                    "An environment where the pet's nose and face are clearly visible works best.")
                Tip(Icons.Filled.CenterFocusStrong, "Follow the guide.",
                    "Fit the dog's nose inside the on-screen guide.")
                Tip(Icons.AutoMirrored.Outlined.VolumeUp, "Use sounds to draw attention.",
                    "Sounds can help get your pet to look at the camera.")
            }

            // The URL is not a secret; the token is never shown.
            Text(
                AppConfig.serverUrl?.takeIf { AppConfig.isServerMode }?.let { "Server mode: $it" } ?: "Camera-only mode",
                fontSize = 12.sp,
                color = Petify.inkMuted,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }
    }
}

/**
 * Server mode: the pets this example registered, from the example server. Home is
 * composed afresh each time the user comes back, so a new registration shows up.
 */
@Composable
private fun PetList(enabled: Boolean, onVerify: (String) -> Unit) {
    var pets by remember { mutableStateOf<Result<List<ExampleServer.Pet>>?>(null) }
    // "Retry" bumps this to load the list again.
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(attempt) {
        pets = null
        pets = try {
            Result.success(ExampleServer.listPets())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    val current = pets
    when {
        current == null -> CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
        current.isFailure -> Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                current.exceptionOrNull()?.message ?: "Could not load pets",
                color = Petify.error,
                fontSize = 14.sp,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { attempt++ }) { Text("Retry") }
        }
        current.getOrThrow().isEmpty() ->
            Text("No pets yet. Register a pet first.", fontSize = 14.sp, color = Petify.inkMuted)
        else -> Column {
            current.getOrThrow().forEachIndexed { index, pet ->
                if (index > 0) HorizontalDivider(color = Petify.hairline)
                PetRow(pet, enabled) { onVerify(pet.petId) }
            }
        }
    }
}

@Composable
private fun PetRow(pet: ExampleServer.Pet, enabled: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Petify.surfaceTint),
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.Filled.Pets, contentDescription = null, tint = Petify.brand) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(pet.petId.take(8) + "…", fontSize = 16.sp, fontWeight = FontWeight.Medium, color = Petify.ink)
            Text("Tap to verify this pet", fontSize = 14.sp, color = Petify.inkMuted)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Petify.inkFaint)
    }
}

/** One of the two big tiles: title top-left, a large faded icon bleeding off the bottom-right. */
@Composable
private fun ActionCard(title: String, icon: ImageVector, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .height(176.dp)
            .alpha(if (enabled) 1f else 0.4f)
            .clip(RoundedCornerShape(12.dp))
            .background(Petify.actionCard)
            .clickable(enabled = enabled, onClick = onClick),
    ) {
        Text(
            title,
            color = Color.White,
            fontSize = 22.sp,
            lineHeight = 28.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(16.dp),
        )
        Icon(
            icon,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.3f),
            modifier = Modifier.align(Alignment.BottomEnd).offset(x = 8.dp, y = 8.dp).size(76.dp),
        )
    }
}

@Composable
private fun Tip(icon: ImageVector, title: String, body: String) {
    Row {
        Icon(icon, contentDescription = null, tint = Petify.main, modifier = Modifier.size(28.dp))
        Spacer(Modifier.width(12.dp))
        Column {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Petify.ink)
            Text(body, fontSize = 14.sp, color = Petify.inkMuted)
        }
    }
}

@Composable
private fun Notice(icon: ImageVector?, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = Petify.error, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, color = Petify.error, fontSize = 14.sp)
    }
}
