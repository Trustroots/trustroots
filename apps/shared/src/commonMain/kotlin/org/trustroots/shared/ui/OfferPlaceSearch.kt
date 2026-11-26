package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp

class OfferPlaceSearchState {
    internal var query by mutableStateOf("")
    internal var failed by mutableStateOf(false)
        private set

    fun updateFailure(failed: Boolean) {
        this.failed = failed
    }
}

@Composable
internal fun OfferPlaceSearchControls(
    state: OfferPlaceSearchState,
    onSearch: (String) -> Unit,
    onFilters: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val focusManager = LocalFocusManager.current
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PilotInput(
            label = "Search for a place",
            value = state.query,
            tag = "offer-place-search-field",
            enabled = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(
                onSearch = {
                    val query = state.query.trim()
                    if (query.isNotEmpty()) {
                        focusManager.clearFocus()
                        onSearch(query)
                    }
                },
            ),
            onChange = { state.query = it },
        )
        if (state.failed) {
            PilotError("Could not find that place.")
        }
        PilotButton(
            "Search filters",
            modifier = Modifier.fillMaxWidth().testTag("offer-results-search-filters"),
            onClick = {
                focusManager.clearFocus()
                onFilters()
            },
        )
    }
}
