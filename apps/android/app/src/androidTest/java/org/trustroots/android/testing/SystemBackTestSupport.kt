package org.trustroots.android.testing

import android.app.Activity
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.pressBack
import androidx.test.espresso.matcher.RootMatchers.withDecorView
import androidx.test.espresso.matcher.ViewMatchers.isRoot
import org.hamcrest.Matchers.not
import org.hamcrest.Matchers.sameInstance

/** Selects the active dialog or popup root instead of Espresso's default activity root. */
internal fun pressBackFromNonActivityRoot(activity: Activity) {
    onView(isRoot())
        .inRoot(withDecorView(not(sameInstance(activity.window.decorView))))
        .perform(pressBack())
}
