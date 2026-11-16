package org.trustroots.shared.ui

import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

// A screen's scope cancels delivery from an obsolete request when it leaves composition.
internal suspend fun awaitAction(request: ((String?) -> Unit) -> Unit): String? =
    suspendCancellableCoroutine { continuation -> request { continuation.resume(it) } }

internal suspend fun <T : Any> awaitData(request: ((T?, String?) -> Unit) -> Unit): Result<T> =
    suspendCancellableCoroutine { continuation ->
        request { value, error ->
            continuation.resume(
                if (value != null) Result.success(value)
                else Result.failure(IllegalStateException(error ?: "The server returned no data.")),
            )
        }
    }
