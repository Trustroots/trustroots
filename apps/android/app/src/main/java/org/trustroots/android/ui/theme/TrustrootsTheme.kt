package org.trustroots.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.colorResource
import org.trustroots.android.R

@Composable
fun TrustrootsTheme(
    content: @Composable () -> Unit,
) {
    val darkTheme = isSystemInDarkTheme()
    val colorScheme = if (darkTheme) trustrootsDarkColorScheme() else trustrootsLightColorScheme()
    MaterialTheme(
        colorScheme = colorScheme,
    ) {
        CompositionLocalProvider(LocalContentColor provides colorScheme.onBackground, content = content)
    }
}

@Composable
internal fun HostResultCardTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = hostResultCardColorScheme(), content = content)
}

@Composable
private fun trustrootsLightColorScheme() = lightColorScheme(
    surfaceTint = Color.Transparent,
    primary = colorResource(R.color.trustroots_primary),
    onPrimary = colorResource(R.color.trustroots_on_primary),
    primaryContainer = colorResource(R.color.trustroots_primary_container),
    onPrimaryContainer = colorResource(R.color.trustroots_on_primary_container),
    secondary = colorResource(R.color.trustroots_secondary),
    onSecondary = colorResource(R.color.trustroots_on_secondary),
    secondaryContainer = colorResource(R.color.trustroots_secondary_container),
    onSecondaryContainer = colorResource(R.color.trustroots_on_secondary_container),
    background = colorResource(R.color.trustroots_background),
    onBackground = colorResource(R.color.trustroots_on_surface),
    surface = colorResource(R.color.trustroots_surface),
    surfaceDim = colorResource(R.color.trustroots_surface_dim),
    surfaceBright = colorResource(R.color.trustroots_surface_bright),
    surfaceContainerLowest = colorResource(R.color.trustroots_surface_container_lowest),
    surfaceContainerLow = colorResource(R.color.trustroots_surface_container_low),
    surfaceContainer = colorResource(R.color.trustroots_surface_container),
    surfaceContainerHigh = colorResource(R.color.trustroots_surface_container_high),
    surfaceContainerHighest = colorResource(R.color.trustroots_surface_container_highest),
    onSurface = colorResource(R.color.trustroots_on_surface),
    surfaceVariant = colorResource(R.color.trustroots_surface_variant),
    onSurfaceVariant = colorResource(R.color.trustroots_on_surface_variant),
    error = colorResource(R.color.trustroots_error),
    onError = colorResource(R.color.trustroots_on_error),
    outline = colorResource(R.color.trustroots_outline),
    inverseSurface = colorResource(R.color.trustroots_inverse_surface),
    inverseOnSurface = colorResource(R.color.trustroots_inverse_on_surface),
    inversePrimary = colorResource(R.color.trustroots_inverse_primary),
)

@Composable
private fun trustrootsDarkColorScheme() = darkColorScheme(
    surfaceTint = Color.Transparent,
    primary = colorResource(R.color.trustroots_primary),
    onPrimary = colorResource(R.color.trustroots_on_primary),
    primaryContainer = colorResource(R.color.trustroots_primary_container),
    onPrimaryContainer = colorResource(R.color.trustroots_on_primary_container),
    secondary = colorResource(R.color.trustroots_secondary),
    onSecondary = colorResource(R.color.trustroots_on_secondary),
    secondaryContainer = colorResource(R.color.trustroots_secondary_container),
    onSecondaryContainer = colorResource(R.color.trustroots_on_secondary_container),
    background = colorResource(R.color.trustroots_background),
    onBackground = colorResource(R.color.trustroots_on_surface),
    surface = colorResource(R.color.trustroots_surface),
    surfaceDim = colorResource(R.color.trustroots_surface_dim),
    surfaceBright = colorResource(R.color.trustroots_surface_bright),
    surfaceContainerLowest = colorResource(R.color.trustroots_surface_container_lowest),
    surfaceContainerLow = colorResource(R.color.trustroots_surface_container_low),
    surfaceContainer = colorResource(R.color.trustroots_surface_container),
    surfaceContainerHigh = colorResource(R.color.trustroots_surface_container_high),
    surfaceContainerHighest = colorResource(R.color.trustroots_surface_container_highest),
    onSurface = colorResource(R.color.trustroots_on_surface),
    surfaceVariant = colorResource(R.color.trustroots_surface_variant),
    onSurfaceVariant = colorResource(R.color.trustroots_on_surface_variant),
    error = colorResource(R.color.trustroots_error),
    onError = colorResource(R.color.trustroots_on_error),
    outline = colorResource(R.color.trustroots_outline),
    inverseSurface = colorResource(R.color.trustroots_inverse_surface),
    inverseOnSurface = colorResource(R.color.trustroots_inverse_on_surface),
    inversePrimary = colorResource(R.color.trustroots_inverse_primary),
)

@Composable
private fun hostResultCardColorScheme() = lightColorScheme(
    surfaceTint = Color.Transparent,
    primary = colorResource(R.color.host_card_primary),
    onPrimary = colorResource(R.color.host_card_on_primary),
    primaryContainer = colorResource(R.color.host_card_primary_container),
    onPrimaryContainer = colorResource(R.color.host_card_on_primary_container),
    secondary = colorResource(R.color.host_card_secondary),
    onSecondary = colorResource(R.color.host_card_on_secondary),
    secondaryContainer = colorResource(R.color.host_card_secondary_container),
    onSecondaryContainer = colorResource(R.color.host_card_on_secondary_container),
    background = colorResource(R.color.host_card_surface),
    onBackground = colorResource(R.color.host_card_on_surface),
    surface = colorResource(R.color.host_card_surface),
    onSurface = colorResource(R.color.host_card_on_surface),
    surfaceVariant = colorResource(R.color.host_card_surface_variant),
    onSurfaceVariant = colorResource(R.color.host_card_on_surface_variant),
)
