package org.trustroots.android.ui.common

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper

/** Finds the requested Activity through themed contexts, or returns null for non-Activity hosts. */
internal fun <T : Activity> Context.findActivity(type: Class<T>): T? {
    var context: Context = this
    while (context is ContextWrapper) {
        if (type.isInstance(context)) return type.cast(context)
        context = context.baseContext
    }
    // Activity inherits ContextWrapper, so a remaining unwrapped context cannot be one.
    return null
}
