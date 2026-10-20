package org.trustroots.android.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
internal fun LiveFilterField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    clearLabel: String,
    modifier: Modifier = Modifier,
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        shape = CircleShape,
        colors = searchFieldColors(),
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
        trailingIcon = {
            ClearSearchButton(value, clearLabel) { onValueChange("") }
        },
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
internal fun SubmittedSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    clearLabel: String,
    searchLabel: String,
    onSearch: () -> Unit,
    searchEnabled: Boolean,
    modifier: Modifier = Modifier,
    searchMode: (@Composable () -> Unit)? = null,
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        singleLine = true,
        shape = CircleShape,
        colors = searchFieldColors(),
        leadingIcon = searchMode,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { if (searchEnabled) onSearch() }),
        trailingIcon = {
            Row(
                modifier = Modifier.padding(end = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                ClearSearchButton(value, clearLabel) { onValueChange("") }
                FilledIconButton(
                    onClick = onSearch,
                    enabled = searchEnabled,
                    shape = CircleShape,
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(Icons.Default.Search, contentDescription = searchLabel)
                }
            }
        },
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
private fun ClearSearchButton(value: String, label: String, onClear: () -> Unit) {
    if (value.isNotEmpty()) {
        IconButton(onClick = onClear, modifier = Modifier.size(48.dp)) {
            Icon(Icons.Default.Close, contentDescription = label)
        }
    }
}

@Composable
private fun searchFieldColors() = TextFieldDefaults.colors(
    focusedIndicatorColor = Color.Transparent,
    unfocusedIndicatorColor = Color.Transparent,
)
