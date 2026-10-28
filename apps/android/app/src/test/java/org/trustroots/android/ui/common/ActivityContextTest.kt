package org.trustroots.android.ui.common

import android.app.Activity
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class ActivityContextTest {
    @Test fun findsTheRequestedActivityThroughNestedThemedContexts() {
        val activity = Robolectric.buildActivity(ComponentActivity::class.java).get()
        assertSame(activity, activity.findActivity(ComponentActivity::class.java))
        assertSame(activity, ContextWrapper(ContextWrapper(activity)).findActivity(ComponentActivity::class.java))
    }

    @Test fun applicationContextsAndWrongActivityTypesDoNotInventAnOwner() {
        assertNull(RuntimeEnvironment.getApplication().findActivity(ComponentActivity::class.java))
        val activity = Robolectric.buildActivity(Activity::class.java).get()
        assertNull(activity.findActivity(ComponentActivity::class.java))
    }
}
