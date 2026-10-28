package org.trustroots.android.ui.circles

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.CircleMemberGroups
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.TrustrootsCircle

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CirclesViewModelInvalidationTest {
    @Test
    fun expiredSessionBlocksOverviewMembershipChangesAndMutationUntilEnvironmentChanges() = withScope { scope ->
        val repository = ExpiredSessionRepository()
        val circle = TrustrootsCircle(
            id = "quiet-id",
            slug = "quiet-circle",
            label = "Quiet Circle",
            description = "A fictional circle",
            count = 2,
            image = false,
            color = null,
        )
        val viewModel = CirclesViewModel(repository, scope)
        val invalidation = requireNotNull(viewModel.state.value.pendingSessionInvalidation)

        viewModel.onEvent(CirclesEvent.MembershipChanged(circle.id, true))
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))
        assertTrue(viewModel.state.value.memberships.isEmpty())
        assertTrue(repository.membershipChanges.isEmpty())

        viewModel.onEvent(CirclesEvent.SessionInvalidationDelivered(invalidation.id))
        viewModel.onEvent(CirclesEvent.MembershipChanged(circle.id, true))
        viewModel.onEvent(CirclesEvent.RetryLoad)
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))

        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertTrue(viewModel.state.value.memberships.isEmpty())
        assertTrue(repository.membershipChanges.isEmpty())
        assertEquals(1, repository.circleReads)
        assertFalse(viewModel.state.value.isLoading)
    }

    private fun withScope(test: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            test(scope)
        } finally {
            scope.cancel()
        }
    }

    private class ExpiredSessionRepository : CircleRepository {
        var circleReads = 0
        val membershipChanges = mutableListOf<Pair<String, Boolean>>()

        override suspend fun circles(): Result<List<TrustrootsCircle>> {
            circleReads++
            return Result.failure(MobileApiException(401, "Expired"))
        }

        override suspend fun circleBySlug(slug: String): Result<TrustrootsCircle> =
            error("The overview does not request an individual circle")

        override suspend fun circleMembers(slug: String): Result<CircleMemberGroups> =
            error("The overview does not request member groups")

        override suspend fun memberships(): Result<Set<String>> = Result.success(emptySet())

        override suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit> {
            membershipChanges += circleID to isMember
            return Result.success(Unit)
        }
    }
}
