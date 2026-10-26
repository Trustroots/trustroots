package org.trustroots.android.ui.common

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test

class RequestResultTest {
    @Test
    fun returnsImmediateAndDeferredResults() = runBlocking {
        assertEquals(Result.success("ready"), requestResult { Result.success("ready") })

        val response = CompletableDeferred<Result<String>>()
        val pending = async(start = CoroutineStart.UNDISPATCHED) { requestResult { response.await() } }
        assertFalse(pending.isCompleted)
        response.complete(Result.success("eventually ready"))

        assertEquals(Result.success("eventually ready"), pending.await())
    }

    @Test
    fun wrapsThrownFailuresWithoutReplacingTheThrowable() = runBlocking {
        val failure = IllegalStateException("temporary request failure")

        val result = requestResult<String> { throw failure }

        assertSame(failure, result.exceptionOrNull())
    }

    @Test
    fun propagatesThrownCancellation() = runBlocking {
        val cancellation = CancellationException("request cancelled")

        val thrown = assertThrows(CancellationException::class.java) {
            runBlocking { requestResult<String> { throw cancellation } }
        }

        assertSame(cancellation, thrown)
    }

    @Test
    fun propagatesCancellationReturnedAsAResult() {
        val cancellation = CancellationException("request cancelled")

        val thrown = assertThrows(CancellationException::class.java) {
            runBlocking { requestResult<String> { Result.failure(cancellation) } }
        }

        assertSame(cancellation, thrown)
    }

    @Test
    fun preservesAnOrdinaryFailureReturnedAsAResult() = runBlocking {
        val failure = IllegalArgumentException("request failed")

        assertSame(failure, requestResult<String> { Result.failure(failure) }.exceptionOrNull())
    }

    @Test
    fun checksTheCoroutineAfterAnOperationCancelsItsJobBeforeReturningSuccess() {
        var delivered = false
        assertThrows(CancellationException::class.java) {
            runBlocking {
                async {
                    val result = requestResult {
                        currentCoroutineContext().cancel(CancellationException("request superseded"))
                        Result.success("late response")
                    }
                    delivered = true
                    result
                }.await()
            }
        }
        assertFalse("A cancelled request must not deliver its late result", delivered)
    }
}
