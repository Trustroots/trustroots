package org.trustroots.android.ui

import android.view.View
import androidx.compose.runtime.AbstractApplier
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Composition
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Recomposer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import kotlin.coroutines.EmptyCoroutineContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.TrustrootsBrowser
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.editprofile.EditProfileScreen

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class TrustrootsAppHostContractTest {
    @Test
    fun rejectsAContextWithoutAComponentActivity() {
        val error = compositionFailure {
            CompositionLocalProvider(LocalContext provides RuntimeEnvironment.getApplication()) {
                TrustrootsApp()
            }
        }
        assertEquals("TrustrootsApp must run in a ComponentActivity.", error.message)
    }

    @Test
    fun browserRejectsAHostWithoutAnEntryViewModelStore() {
        val context = RuntimeEnvironment.getApplication()
        compositionFailure {
            CompositionLocalProvider(
                LocalContext provides context,
                LocalView provides View(context),
            ) {
                TrustrootsBrowser(BrowserRoute(title = "Fictional page", url = "https://example.test"), onClose = {})
            }
        }
    }

    @Test
    fun editProfileRequiresAUsernameWhenNoCanonicalProfileIsProvided() {
        val error = compositionFailure {
            EditProfileScreen(
                api = MobileApiClient("https://api.example.test"),
                session = MemberSession("connect.sid=fictional-session", MobileMember("quiet-fox", "Quiet Fox")),
                onSessionInvalidated = {},
                onCancel = {},
                onSaved = {},
            )
        }
        assertEquals("A username or canonical profile is required.", error.message)
    }

    private fun compositionFailure(content: @Composable () -> Unit): IllegalArgumentException {
        val recomposer = Recomposer(EmptyCoroutineContext)
        val composition = Composition(object : AbstractApplier<Unit>(Unit) {
            override fun insertTopDown(index: Int, instance: Unit) = Unit
            override fun insertBottomUp(index: Int, instance: Unit) = Unit
            override fun remove(index: Int, count: Int) = Unit
            override fun move(from: Int, to: Int, count: Int) = Unit
            override fun onClear() = Unit
        }, recomposer)

        try {
            return assertThrows(IllegalArgumentException::class.java) {
                composition.setContent(content)
            }
        } finally {
            composition.dispose()
            recomposer.cancel()
        }
    }
}
