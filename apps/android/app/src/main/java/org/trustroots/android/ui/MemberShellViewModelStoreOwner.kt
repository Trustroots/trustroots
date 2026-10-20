package org.trustroots.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner

/** Holds all Navigation 3 entry stores for one signed-in account across Activity recreation. */
internal class MemberShellViewModelStoreOwner : ViewModel(), ViewModelStoreOwner {
    private var accountUsername: String? = null
    private var entryStores = ViewModelStore()

    override val viewModelStore: ViewModelStore
        get() = entryStores

    fun activateAccount(username: String): MemberShellViewModelStoreOwner {
        if (accountUsername != username) {
            entryStores.clear()
            entryStores = ViewModelStore()
            accountUsername = username
        }
        return this
    }

    fun clearAccount() {
        entryStores.clear()
        entryStores = ViewModelStore()
        accountUsername = null
    }

    override fun onCleared() {
        clearAccount()
        super.onCleared()
    }
}
