package org.trustroots.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner

/** Activity-retained Navigation 3 graph container; shell business state stays in route entries. */
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
