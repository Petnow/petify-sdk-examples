package com.example.petify.prewarm

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The Petify app's palette, shared by the iOS, Android, React Native and Flutter examples. */
object Petify {
    val appBg = Color(0xFFF3F3F4)
    val surface = Color(0xFFFFFFFF)
    val main = Color(0xFFFF592C)
    val mainPressed = Color(0xFFCE4926)
    val mainTint = Color(0xFFFFF3F1)
    val actionCard = Color(0xFF5476CD)
    val brand = Color(0xFF0033B5)
    val surfaceTint = Color(0xFFE8EDF9)
    val ink = Color(0xFF111111)
    val inkMuted = Color(0xFF4B5563)
    val inkFaint = Color(0xFF9CA3AF)
    val hairline = Color(0xFFE5E7EB)
    val success = Color(0xFF2FC869)
    val error = Color(0xFFFF323E)
}

/** Light only: the palette has no dark variant. */
@Composable
fun PetifyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Petify.main,
            onPrimary = Color.White,
            primaryContainer = Petify.mainTint,
            secondary = Petify.actionCard,
            background = Petify.appBg,
            onBackground = Petify.ink,
            surface = Petify.surface,
            onSurface = Petify.ink,
            onSurfaceVariant = Petify.inkMuted,
            surfaceVariant = Petify.mainTint, // progress tracks
            secondaryContainer = Petify.mainTint,
            outline = Petify.hairline,
            outlineVariant = Petify.hairline,
            error = Petify.error,
        ),
        content = content,
    )
}

private val ButtonShape = RoundedCornerShape(12.dp)

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = ButtonShape,
        modifier = modifier.fillMaxWidth().height(52.dp),
    ) { Text(text, fontWeight = FontWeight.Medium, fontSize = 16.sp) }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = ButtonShape,
        border = BorderStroke(1.dp, if (enabled) Petify.main else Petify.hairline),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Petify.main),
        modifier = modifier.fillMaxWidth().height(52.dp),
    ) { Text(text, fontWeight = FontWeight.Medium, fontSize = 16.sp) }
}

/** A white card with an optional icon + title header. */
@Composable
fun PetifyCard(
    modifier: Modifier = Modifier,
    title: String? = null,
    icon: ImageVector? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Petify.surface, contentColor = Petify.ink),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (title != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (icon != null) {
                        Icon(icon, contentDescription = null, tint = Petify.main, modifier = Modifier.size(24.dp))
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
            content()
        }
    }
}
