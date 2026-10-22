package org.trustroots.android.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner

/**
 * Remembers an entry-scoped ViewModel for the lifetime of its composition.
 * Account or session teardown can clear a route store before its outgoing composition is disposed,
 * so the composition must keep returning its existing ViewModel during that final frame.
 */
@Composable
internal fun <T : ViewModel> rememberEntryViewModel(
    owner: ViewModelStoreOwner,
    modelClass: Class<T>,
    factory: ViewModelProvider.Factory,
    key: String? = null,
): T = remember(owner, modelClass, key) {
    val provider = ViewModelProvider(owner, factory)
    if (key == null) provider[modelClass] else provider[key, modelClass]
}
