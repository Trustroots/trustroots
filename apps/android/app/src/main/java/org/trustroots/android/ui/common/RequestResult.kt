package org.trustroots.android.ui.common

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/** Runs a result-returning request while preserving coroutine cancellation semantics. */
internal suspend fun <T> requestResult(operation: suspend () -> Result<T>): Result<T> {
    val result = try {
        operation()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (error: Throwable) {
        Result.failure(error)
    }
    currentCoroutineContext().ensureActive()
    (result.exceptionOrNull() as? CancellationException)?.let { throw it }
    return result
}
