package org.trustroots.android.ui

import androidx.compose.runtime.AbstractApplier
import androidx.compose.runtime.Composition
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Recomposer
import androidx.compose.ui.platform.LocalContext
import kotlin.coroutines.EmptyCoroutineContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class TrustrootsAppHostContractTest {
    @Test
    fun rejectsAContextWithoutAComponentActivity() {
        val recomposer = Recomposer(EmptyCoroutineContext)
        val composition = Composition(object : AbstractApplier<Unit>(Unit) {
            override fun insertTopDown(index: Int, instance: Unit) = Unit
            override fun insertBottomUp(index: Int, instance: Unit) = Unit
            override fun remove(index: Int, count: Int) = Unit
            override fun move(from: Int, to: Int, count: Int) = Unit
            override fun onClear() = Unit
        }, recomposer)

        try {
            val error = assertThrows(IllegalArgumentException::class.java) {
                composition.setContent {
                    CompositionLocalProvider(LocalContext provides RuntimeEnvironment.getApplication()) {
                        TrustrootsApp()
                    }
                }
            }

            assertEquals("TrustrootsApp must run in a ComponentActivity.", error.message)
        } finally {
            composition.dispose()
            recomposer.cancel()
        }
    }
}
