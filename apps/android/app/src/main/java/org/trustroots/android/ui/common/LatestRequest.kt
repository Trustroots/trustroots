package org.trustroots.android.ui.common

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Replaceable work confined to its owner's dispatcher. Registering the lazy job
 * first lets synchronous cancellation and startup callbacks supersede it safely.
 */
internal class LatestRequest(private val scope: CoroutineScope) {
    private var job: Job? = null

    val isActive: Boolean get() = job?.isActive == true

    fun launch(block: suspend CoroutineScope.() -> Unit): Job {
        val previous = job
        val next = scope.launch(start = CoroutineStart.LAZY, block = block)
        job = next
        previous?.cancel()
        next.start()
        return next
    }

    fun cancel() {
        val previous = job
        job = null
        previous?.cancel()
    }
}
