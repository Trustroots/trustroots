package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal data class PilotPalette(
    val background: Color,
    val surface: Color,
    val ink: Color,
    val accent: Color,
    val onAccent: Color,
    val border: Color,
    val error: Color,
)

private val light = PilotPalette(
    Color.White, Color(0xFFF0F6F3), Color(0xFF18221D), Color(0xFF076B58),
    Color.White, Color(0xFF718079), Color(0xFFBA1A1A),
)
private val dark = PilotPalette(
    Color(0xFF101A16), Color(0xFF24332B), Color(0xFFE0F0E8), Color(0xFF79DBBE),
    Color(0xFF00372B), Color(0xFF8B9D93), Color(0xFFFFB4AB),
)

internal val pilotPalette: PilotPalette
    @Composable get() = if (isSystemInDarkTheme()) dark else light

@Composable
internal fun PilotTitle(value: String) {
    BasicText(
        value,
        modifier = Modifier.semantics { heading() },
        style = TextStyle(color = pilotPalette.ink, fontSize = 22.sp, fontWeight = FontWeight.Bold),
    )
}

@Composable
internal fun PilotText(
    value: String,
    modifier: Modifier = Modifier,
    colour: Color = pilotPalette.ink,
    strong: Boolean = false,
) {
    BasicText(
        value,
        modifier = modifier,
        style = TextStyle(
            color = colour,
            fontSize = 16.sp,
            lineHeight = 22.sp,
            fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Normal,
        ),
    )
}

@Composable
internal fun PilotError(value: String) {
    PilotText(
        value,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        colour = pilotPalette.error,
    )
}

@Composable
internal fun PilotButton(
    label: String,
    enabled: Boolean = true,
    primary: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val palette = pilotPalette
    val shape = RoundedCornerShape(12.dp)
    val emphasis = if (enabled) 1f else 0.5f
    Box(
        modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(shape)
            .background(if (primary) palette.accent.copy(alpha = emphasis) else palette.surface)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        PilotText(
            label,
            colour = if (primary) palette.onAccent else palette.ink.copy(alpha = emphasis),
            strong = true,
        )
    }
}

@Composable
internal fun PilotInput(
    label: String,
    value: String,
    tag: String,
    enabled: Boolean,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    singleLine: Boolean = true,
    maxLines: Int = if (singleLine) 1 else 4,
    modifier: Modifier = Modifier,
    onChange: (String) -> Unit,
) {
    val palette = pilotPalette
    val shape = RoundedCornerShape(10.dp)
    Column {
        PilotText(label, Modifier.padding(bottom = 4.dp), strong = true)
        BasicTextField(
            value,
            onValueChange = onChange,
            modifier = modifier
                .fillMaxWidth()
                .testTag(tag)
                .semantics { contentDescription = label },
            enabled = enabled,
            textStyle = TextStyle(color = palette.ink, fontSize = 16.sp, lineHeight = 22.sp),
            keyboardOptions = keyboardOptions,
            singleLine = singleLine,
            maxLines = maxLines,
            visualTransformation = if (keyboardOptions.keyboardType == KeyboardType.Password) {
                PasswordVisualTransformation()
            } else {
                VisualTransformation.None
            },
            cursorBrush = SolidColor(palette.accent),
            decorationBox = { field ->
                Box(
                    Modifier.fillMaxWidth()
                        .defaultMinSize(minHeight = 48.dp)
                        .background(palette.surface, shape)
                        .border(1.dp, palette.border, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    contentAlignment = Alignment.CenterStart,
                ) { field() }
            },
        )
    }
}
