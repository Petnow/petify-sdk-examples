package com.example.petify.prewarm

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun HomeScreen(onStart: (Purpose) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.weight(1f))
        Text("Petify SDK prewarm example", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Home → capture guide (prewarm) → camera → result. Nothing is prepared until you start.",
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        // The URL is not a secret; the token is never shown.
        Text(
            AppConfig.serverUrl?.let { "Server mode: $it" } ?: "Camera-only mode",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.weight(1f))
        if (AppConfig.apiKey == null) {
            Text(
                "Set petnow.apiKey in android/local.properties, then rebuild.",
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
            )
        }
        if (AppConfig.serverConfigIncomplete) {
            Text(
                "Set both example.serverUrl and example.serverToken in android/local.properties, then rebuild.",
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
            )
        }
        Button(
            onClick = { onStart(Purpose.IDENTIFY) },
            enabled = AppConfig.apiKey != null,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Identify a pet") }
        // Registering creates a pet, which needs the Secret key: only the example server has it.
        OutlinedButton(
            onClick = { onStart(Purpose.REGISTER) },
            enabled = AppConfig.apiKey != null && AppConfig.isServerMode,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Register a pet") }
        if (!AppConfig.isServerMode) {
            Text(
                "Needs the example server (see server/README)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
