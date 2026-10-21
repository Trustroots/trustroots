package org.trustroots.android.ui.common

import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RememberEntryViewModelTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun sameOwnerAndKeyKeepTheCompositionInstanceWhenFactoryChanges() {
        val owner = TestOwner()
        val createCount = AtomicInteger()
        val current = AtomicReference<TestEntryViewModel?>()
        val revision = mutableIntStateOf(0)
        var factory = factory(createCount, "first")
        try {
            compose.setContent {
                revision.intValue
                val model = rememberEntryViewModel(owner, TestEntryViewModel::class.java, factory)
                SideEffect { current.set(model) }
            }
            compose.waitForIdle()
            val first = requireNotNull(current.get())

            compose.runOnIdle {
                factory = factory(createCount, "replacement")
                revision.intValue++
            }
            compose.waitForIdle()

            assertSame(first, current.get())
            assertEquals("first", current.get()?.name)
            assertEquals(1, createCount.get())
        } finally {
            owner.viewModelStore.clear()
        }
    }

    @Test
    fun clearedOwnerStoreStillReturnsTheRememberedModelUntilCompositionEnds() {
        val owner = TestOwner()
        val createCount = AtomicInteger()
        val clearCount = AtomicInteger()
        val current = AtomicReference<TestEntryViewModel?>()
        val revision = mutableIntStateOf(0)
        var factory = factory(createCount, "cached", clearCount)
        try {
            compose.setContent {
                revision.intValue
                val model = rememberEntryViewModel(owner, TestEntryViewModel::class.java, factory)
                SideEffect { current.set(model) }
            }
            compose.waitForIdle()
            val first = requireNotNull(current.get())

            compose.runOnIdle {
                owner.viewModelStore.clear()
                factory = factory(createCount, "replacement", clearCount)
                revision.intValue++
            }
            compose.waitForIdle()

            assertSame(first, current.get())
            assertEquals(1, createCount.get())
            assertEquals(1, clearCount.get())
        } finally {
            owner.viewModelStore.clear()
        }
    }

    @Test
    fun changingKeyOrOwnerCreatesSeparateModelsWhichTheirStoresClear() {
        val firstOwner = TestOwner()
        val secondOwner = TestOwner()
        val createCount = AtomicInteger()
        val clearCount = AtomicInteger()
        val current = AtomicReference<TestEntryViewModel?>()
        val revision = mutableIntStateOf(0)
        var owner: TestOwner = firstOwner
        var key = "first-key"
        val factory = factory(createCount, "model", clearCount)
        try {
            compose.setContent {
                revision.intValue
                val model = rememberEntryViewModel(owner, TestEntryViewModel::class.java, factory, key)
                SideEffect { current.set(model) }
            }
            compose.waitForIdle()
            val first = requireNotNull(current.get())

            compose.runOnIdle {
                key = "second-key"
                revision.intValue++
            }
            compose.waitForIdle()
            val second = requireNotNull(current.get())
            assertNotSame(first, second)

            compose.runOnIdle {
                owner = secondOwner
                revision.intValue++
            }
            compose.waitForIdle()
            val third = requireNotNull(current.get())
            assertNotSame(second, third)
            assertEquals(3, createCount.get())

            firstOwner.viewModelStore.clear()
            secondOwner.viewModelStore.clear()
            assertEquals(3, clearCount.get())
        } finally {
            firstOwner.viewModelStore.clear()
            secondOwner.viewModelStore.clear()
        }
    }

    private fun factory(
        createCount: AtomicInteger,
        name: String,
        clearCount: AtomicInteger = AtomicInteger(),
    ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(TestEntryViewModel::class.java))
            @Suppress("UNCHECKED_CAST")
            return TestEntryViewModel(name, createCount.incrementAndGet(), clearCount) as T
        }
    }

    private class TestOwner(override val viewModelStore: ViewModelStore = ViewModelStore()) : ViewModelStoreOwner

    private class TestEntryViewModel(
        val name: String,
        val creationNumber: Int,
        private val clearCount: AtomicInteger,
    ) : ViewModel() {
        override fun onCleared() {
            clearCount.incrementAndGet()
        }
    }
}
