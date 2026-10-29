package org.trustroots.android.ui.common

import android.view.View
import android.widget.FrameLayout
import androidx.compose.runtime.AbstractApplier
import androidx.compose.runtime.Composition
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Recomposer
import androidx.compose.ui.platform.LocalView
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import kotlin.coroutines.EmptyCoroutineContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class NavigationViewModelOwnerTest {
    @Test fun returnsTheNavigationEntryOwner() {
        val store = ViewModelStore()
        val owner = object : ViewModelStoreOwner { override val viewModelStore = store }
        withComposition { composition ->
            var actual: ViewModelStoreOwner? = null
            composition.setContent {
                CompositionLocalProvider(LocalViewModelStoreOwner provides owner) {
                    actual = requireNavigationViewModelStoreOwner("Missing navigation entry")
                }
            }
            assertSame(owner, actual)
        }
        store.clear()
    }

    @Test fun missingOwnerFailsWithTheScreenSpecificMessage() {
        val view = View(RuntimeEnvironment.getApplication())
        withComposition { composition ->
            val error = assertThrows(IllegalStateException::class.java) {
                composition.setContent {
                    CompositionLocalProvider(
                        LocalView provides view,
                    ) {
                        requireNavigationViewModelStoreOwner("Missing navigation entry")
                    }
                }
            }
            assertEquals("Missing navigation entry", error.message)
        }
    }

    @Test fun inheritsTheOwnerFromTheHostingViewTree() {
        val store = ViewModelStore()
        val owner = object : ViewModelStoreOwner { override val viewModelStore = store }
        val context = RuntimeEnvironment.getApplication()
        val view = View(context)
        FrameLayout(context).apply {
            setViewTreeViewModelStoreOwner(owner)
            addView(view)
        }
        withComposition { composition ->
            var actual: ViewModelStoreOwner? = null
            composition.setContent {
                CompositionLocalProvider(LocalView provides view) {
                    actual = requireNavigationViewModelStoreOwner("Missing hosting owner")
                }
            }
            assertSame(owner, actual)
        }
        store.clear()
    }

    private fun withComposition(block: (Composition) -> Unit) {
        val recomposer = Recomposer(EmptyCoroutineContext)
        val composition = Composition(object : AbstractApplier<Unit>(Unit) {
            override fun insertTopDown(index: Int, instance: Unit) = Unit
            override fun insertBottomUp(index: Int, instance: Unit) = Unit
            override fun remove(index: Int, count: Int) = Unit
            override fun move(from: Int, to: Int, count: Int) = Unit
            override fun onClear() = Unit
        }, recomposer)
        try {
            block(composition)
        } finally {
            composition.dispose()
            recomposer.cancel()
        }
    }
}
