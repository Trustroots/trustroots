package org.trustroots.android.ui.circledetail

import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.CircleMemberGroups
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.circles.CircleRepository
import org.trustroots.android.ui.circles.CirclesFailureKind

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CircleDetailViewModelConcurrencyTest {
    @Test
    fun groupsFailureArrivingAfterLeavingCannotRestoreFailureOrLoadingState() = withScope { scope ->
        val lateGroups = CompletableDeferred<Result<CircleMemberGroups>>()
        val repository = RaceRepository(lateGroups)
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        assertTrue(viewModel.state.value.isMember)
        assertTrue(viewModel.state.value.isLoadingMembers)
        assertEquals(1, repository.memberGroupReads)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        assertFalse(viewModel.state.value.isMember)
        assertFalse(viewModel.state.value.isLoadingMembers)
        assertNull(viewModel.state.value.memberGroups)

        lateGroups.complete(Result.failure(IOException("Temporary members lookup failure")))

        assertFalse(viewModel.state.value.isMember)
        assertFalse(viewModel.state.value.isLoadingMembers)
        assertNull(viewModel.state.value.memberGroups)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.canRetryLoad)
        assertEquals(listOf("quiet-id" to false, "quiet-id" to true), repository.membershipChanges)
    }

    @Test
    fun membershipToggleBeforeCircleLoadCompletesIsIgnored() = withScope { scope ->
        val circleResponse = CompletableDeferred<Result<TrustrootsCircle>>()
        val repository = RaceRepository(circleResponse = circleResponse)
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)

        assertTrue(viewModel.state.value.isLoading)
        assertFalse(viewModel.state.value.isUpdating)
        assertTrue(repository.membershipChanges.isEmpty())
        circleResponse.complete(Result.failure(IOException("Circle not available yet")))
        assertEquals(CirclesFailureKind.CIRCLE_DETAIL_LOAD, viewModel.state.value.failure?.kind)
    }

    private fun withScope(test: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            test(scope)
        } finally {
            scope.cancel()
        }
    }

    private class RaceRepository(
        private val groupResponse: CompletableDeferred<Result<CircleMemberGroups>>? = null,
        private val circleResponse: CompletableDeferred<Result<TrustrootsCircle>>? = null,
    ) : CircleRepository {
        var memberGroupReads = 0
        val membershipChanges = mutableListOf<Pair<String, Boolean>>()

        override suspend fun circles(): Result<List<TrustrootsCircle>> = Result.success(emptyList())
        override suspend fun circleBySlug(slug: String): Result<TrustrootsCircle> =
            circleResponse?.await() ?: Result.success(circle("quiet-id", slug))
        override suspend fun circleMembers(slug: String): Result<CircleMemberGroups> {
            memberGroupReads++
            return groupResponse?.let { withContext(NonCancellable) { it.await() } }
                ?: Result.success(CircleMemberGroups(emptyList(), emptyList(), emptyList()))
        }
        override suspend fun memberships(): Result<Set<String>> = Result.success(emptySet())
        override suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit> {
            membershipChanges += circleID to isMember
            return Result.success(Unit)
        }
    }

    private companion object {
        fun circle(id: String, slug: String) = TrustrootsCircle(
            id = id,
            slug = slug,
            label = "Quiet Circle",
            description = "A fictional circle",
            count = 2,
            image = false,
            color = null,
        )
    }
}
