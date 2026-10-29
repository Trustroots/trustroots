package org.trustroots.android.ui.common

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LatestRequestTest {
    @Test
    fun firstRequestStartsAndCancelStopsIt() {
        withLatestRequest { requests ->
            assertFalse(requests.isActive)
            var started = false
            val request = requests.launch {
                started = true
                awaitCancellation()
            }

            assertTrue(started)
            assertTrue(requests.isActive)
            requests.cancel()
            assertTrue(request.isCancelled)
            assertFalse(requests.isActive)
            requests.cancel()
        }
    }

    @Test
    fun aCompletedRequestIsNoLongerActive() {
        withLatestRequest { requests ->
            val request = requests.launch { }
            assertTrue(request.isCompleted)
            assertFalse(requests.isActive)
        }
    }

    @Test
    fun replacingRequestCancelsThePreviousJobAndStartsTheReplacement() {
        withLatestRequest { requests ->
            var oldStarted = false
            var newStarted = false
            val old = requests.launch {
                oldStarted = true
                awaitCancellation()
            }

            val current = requests.launch {
                newStarted = true
                awaitCancellation()
            }

            assertTrue(oldStarted)
            assertTrue(old.isCancelled)
            assertTrue(newStarted)
            assertTrue(current.isActive)
            requests.cancel()
        }
    }

    @Test
    fun reentrantLaunchFromCancellationCallbackKeepsTheNewestJob() {
        withLatestRequest { requests ->
            var replacement: Job? = null
            var replacementStarted = false
            var supersededStarted = false
            val old = requests.launch {
                try {
                    awaitCancellation()
                } finally {
                    replacement = requests.launch {
                        replacementStarted = true
                        awaitCancellation()
                    }
                }
            }

            val superseded = requests.launch {
                supersededStarted = true
                awaitCancellation()
            }

            assertTrue(old.isCancelled)
            assertTrue(superseded.isCancelled)
            assertFalse(supersededStarted)
            assertTrue(replacementStarted)
            requests.cancel()
            assertTrue(requireNotNull(replacement).isCancelled)
        }
    }

    @Test
    fun reentrantRequestReplacementCannotPublishTheOldSynchronousResult() {
        withLatestRequest { requests ->
            var replacementStarted = false
            var oldResultPublished = false
            val old = requests.launch {
                val result = requestResult {
                    requests.launch { replacementStarted = true }
                    Result.success("stale")
                }
                oldResultPublished = result.isSuccess
            }

            assertTrue(old.isCancelled)
            assertTrue(replacementStarted)
            assertFalse(oldResultPublished)
            requests.cancel()
        }
    }

    @Test
    fun cancelledNonCancellableOperationCannotPublishItsLateResult() {
        withLatestRequest { requests ->
            val response = CompletableDeferred<Result<String>>()
            var oldResultPublished = false
            val old = requests.launch {
                val result = requestResult {
                    withContext(NonCancellable) { response.await() }
                }
                oldResultPublished = result.isSuccess
            }

            requests.launch { }
            response.complete(Result.success("stale"))

            assertTrue(old.isCancelled)
            assertTrue(old.isCompleted)
            assertFalse(oldResultPublished)
            requests.cancel()
        }
    }

    private fun withLatestRequest(block: (LatestRequest) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            block(LatestRequest(scope))
        } finally {
            scope.cancel()
        }
    }
}
