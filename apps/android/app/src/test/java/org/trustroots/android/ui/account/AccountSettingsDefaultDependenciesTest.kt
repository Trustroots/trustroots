package org.trustroots.android.ui.account

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.AccountDetails
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.updates.ApkUpdateCheckResult

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class AccountSettingsDefaultDependenciesTest {
    @Test
    fun factoryLoadsWithItsDefaultScopeAndNoInitialApiOrSession() {
        val store = ViewModelStore()
        val owner = object : ViewModelStoreOwner { override val viewModelStore = store }
        var detailsCalls = 0
        val repository = object : AccountRepository {
            override suspend fun details(): Result<AccountDetails> {
                detailsCalls++
                return Result.success(AccountDetails("quiet-fox", "Quiet Fox", "member@example.test"))
            }

            override suspend fun update(email: String, newsletter: Boolean) =
                Result.success(AccountDetails("quiet-fox", "Quiet Fox", email, newsletter = newsletter))

            override suspend fun changePassword(current: String, new: String, verify: String) = Result.success(Unit)
            override suspend fun signOut() = Result.success(Unit)
        }
        val platform = object : AccountPlatformSettings {
            override val messageAlertStatus = MutableStateFlow<MessageAlertStatusMetadata?>(null)
            override fun messageAlertsEnabled(username: String) = false
            override suspend fun disableMessageAlerts() = Unit
            override fun updateAlertsEnabled() = false
            override fun setUpdateAlertsEnabled(enabled: Boolean) = Unit
            override suspend fun checkPreviewUpdates() = ApkUpdateCheckResult.Unavailable
        }
        try {
            val model = ViewModelProvider(owner, AccountSettingsViewModel.Factory("quiet-fox", repository, platform))
                .get(AccountSettingsViewModel::class.java)

            assertEquals("member@example.test", model.state.value.details?.email)
            assertEquals(1, detailsCalls)
        } finally {
            store.clear()
        }
    }
}
