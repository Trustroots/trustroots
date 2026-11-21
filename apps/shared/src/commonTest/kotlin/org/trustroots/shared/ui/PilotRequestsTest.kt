package org.trustroots.shared.ui

import kotlin.coroutines.cancellation.CancellationException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest

class PilotRequestsTest {
    @Test fun actionReturnsSuccessAndUserFacingFailure() = runTest {
        assertNull(awaitAction { complete -> complete(null) })
        assertEquals("Please try again.", awaitAction { complete -> complete("Please try again.") })
    }

    @Test fun dataReturnsTheValueEvenWhenTheHostAlsoSuppliesAnError() = runTest {
        val result = awaitData<String> { complete -> complete("A profile", "Ignored host error") }
        assertEquals("A profile", result.getOrThrow())
    }

    @Test fun missingDataPreservesTheHostErrorOrProvidesAFallback() = runTest {
        val failure = awaitData<String> { complete -> complete(null, "Unable to load profile.") }
        assertEquals("Unable to load profile.", failure.exceptionOrNull()?.message)
        val missing = awaitData<String> { complete -> complete(null, null) }
        assertEquals("The server returned no data.", missing.exceptionOrNull()?.message)
    }

    @Test fun synchronousDuplicateActionCallbacksKeepTheFirstResult() = runTest {
        assertNull(awaitAction { complete ->
            complete(null)
            complete("A late failure")
        })
    }

    @Test fun synchronousDuplicateDataCallbacksKeepTheFirstResult() = runTest {
        val result = awaitData<String> { complete ->
            complete(null, "Original failure")
            complete("A late profile", null)
        }
        assertEquals("Original failure", result.exceptionOrNull()?.message)
    }

    @Test fun suspendedActionAcceptsOnlyItsFirstCallback() = runTest {
        lateinit var complete: (String?) -> Unit
        val request = async(start = CoroutineStart.UNDISPATCHED) { awaitAction { complete = it } }
        assertFalse(request.isCompleted)
        complete("Original result")
        complete(null)
        assertEquals("Original result", request.await())
        complete("An even later result")
    }

    @Test fun suspendedDataAcceptsOnlyItsFirstCallback() = runTest {
        lateinit var complete: (String?, String?) -> Unit
        val request = async(start = CoroutineStart.UNDISPATCHED) { awaitData<String> { complete = it } }
        assertFalse(request.isCompleted)
        complete("Original profile", null)
        complete(null, "A late failure")
        assertEquals("Original profile", request.await().getOrThrow())
        complete("Another late profile", null)
    }

    @Test fun cancelledActionIgnoresRepeatedLateCallbacks() = runTest {
        lateinit var complete: (String?) -> Unit
        val request = async(start = CoroutineStart.UNDISPATCHED) { awaitAction { complete = it } }
        request.cancel()
        complete(null)
        complete("Late failure")
        assertTrue(request.isCancelled)
        assertFailsWith<CancellationException> { request.await() }
    }

    @Test fun cancelledDataIgnoresRepeatedLateCallbacks() = runTest {
        lateinit var complete: (String?, String?) -> Unit
        val request = async(start = CoroutineStart.UNDISPATCHED) { awaitData<String> { complete = it } }
        request.cancel()
        complete("Late profile", null)
        complete(null, "Late failure")
        assertTrue(request.isCancelled)
        assertFailsWith<CancellationException> { request.await() }
    }

    @Test fun cancellationBeforeDispatchPreventsDeliveryOfAnAlreadySuppliedResult() = runTest {
        lateinit var complete: (String?) -> Unit
        var delivered = false
        val request = async(start = CoroutineStart.UNDISPATCHED) {
            awaitAction { complete = it }
            delivered = true
        }
        complete(null)
        request.cancel()
        assertFailsWith<CancellationException> { request.await() }
        assertFalse(delivered)
    }
}
