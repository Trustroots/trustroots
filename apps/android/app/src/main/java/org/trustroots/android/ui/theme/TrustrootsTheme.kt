package org.trustroots.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val TrustrootsGreen = Color(0xFF12B591)
val TrustrootsDarkGreen = Color(0xFF0A8B70)
val TrustrootsPaleGreen = Color(0xFFECF9F5)
val TrustrootsBrown = Color(0xFF5C3B14)

private val TrustrootsColorScheme = lightColorScheme(
    primary = TrustrootsDarkGreen,
    onPrimary = Color.White,
    primaryContainer = TrustrootsPaleGreen,
    onPrimaryContainer = TrustrootsBrown,
    secondary = TrustrootsGreen,
    background = Color(0xFFFAFCFB),
    surface = Color.White,
)

@Composable
fun TrustrootsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TrustrootsColorScheme,
        content = content,
    )
}
