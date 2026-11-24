package org.trustroots.android.ui.account

import android.content.Context
import android.content.ContextWrapper
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class NostrKeyCredentialPromptTest {
    @Test fun cannotOfferABackupPromptWithoutTheDeviceCredentialService() {
        val context = object : ContextWrapper(RuntimeEnvironment.getApplication()) {
            override fun getSystemService(name: String): Any? =
                if (name == Context.KEYGUARD_SERVICE) null else super.getSystemService(name)
        }

        assertNull(deviceCredentialPrompt(context, "Nostr key", "Back up private key"))
    }
}
