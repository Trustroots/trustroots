package org.trustroots.shared.ui

import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex

// A screen's scope cancels delivery from an obsolete request when it leaves composition.
// Native callbacks may outlive that screen or deliver twice; only the first result wins.
internal suspend fun awaitAction(request: ((String?) -> Unit) -> Unit): String? =
    awaitCallback(request)

internal suspend fun <T : Any> awaitData(request: ((T?, String?) -> Unit) -> Unit): Result<T> =
    awaitCallback { complete ->
        request { value, error ->
            complete(
                if (value != null) Result.success(value)
                else Result.failure(IllegalStateException(error ?: "The server returned no data.")),
            )
        }
    }

private suspend fun <T> awaitCallback(request: ((T) -> Unit) -> Unit): T =
    suspendCancellableCoroutine { continuation ->
        // Never unlocked: each registration completes once, even across native threads.
        val delivered = Mutex()
        request { value ->
            if (delivered.tryLock()) continuation.resume(value)
        }
    }
