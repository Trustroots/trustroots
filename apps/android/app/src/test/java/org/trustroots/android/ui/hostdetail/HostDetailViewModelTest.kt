package org.trustroots.android.ui.hostdetail

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
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.search.SearchOfferType

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class HostDetailViewModelTest {
    @Test fun loadOwnsCanonicalOfferProfileAndMembershipData() = withModel { model, repository ->
        model.onEvent(HostDetailEvent.Load("safe-offer-id", SearchOfferType.Meet))

        assertEquals(listOf("safe-offer-id"), repository.offerIDs)
        assertEquals(listOf("host-owl"), repository.profileUsernames)
        assertEquals(1, repository.membershipCalls)
        assertEquals("safe-offer-id", model.state.value.offer?.id)
        assertEquals("host-owl", model.state.value.profile?.username)
        assertEquals(setOf("circle-one"), model.state.value.sharedCircleIDs)
        assertEquals(SearchOfferType.Meet, model.state.value.offerType)
        assertFalse(model.state.value.isLoading)
        assertNull(model.state.value.failure)
    }

    @Test fun retryReloadsCanonicalOfferAfterRetryableFailure() = withModel { model, repository ->
        repository.offerHandler = { call, id ->
            if (call == 1) Result.failure(IllegalStateException("temporary detail failure"))
            else Result.success(offerFixture(id))
        }
        model.onEvent(HostDetailEvent.Load("retry-offer", SearchOfferType.Host))
        assertTrue(model.state.value.failure != null)
        assertNull(model.state.value.offer)

        model.onEvent(HostDetailEvent.Retry)

        assertEquals(listOf("retry-offer", "retry-offer"), repository.offerIDs)
        assertEquals("retry-offer", model.state.value.offer?.id)
        assertNull(model.state.value.failure)
    }

    @Test fun latePreviousSelectionCannotReplaceNewDetail() = withModel { model, repository ->
        val late = CompletableDeferred<Result<HostOffer>>()
        repository.offerHandler = { _, id ->
            if (id == "old-offer") withContext(NonCancellable) { late.await() }
            else Result.success(offerFixture(id))
        }
        model.onEvent(HostDetailEvent.Load("old-offer", SearchOfferType.Host))
        model.onEvent(HostDetailEvent.Load("current-offer", SearchOfferType.Meet))
        late.complete(Result.success(offerFixture("stale-offer")))

        assertEquals("current-offer", model.state.value.offer?.id)
        assertEquals(SearchOfferType.Meet, model.state.value.offerType)
        assertEquals(listOf("old-offer", "current-offer"), repository.offerIDs)
    }

    @Test fun authenticationInvalidationIsOneShotAndStopsDependentReads() = withModel { model, repository ->
        repository.offerHandler = { _, _ -> Result.failure(MobileApiException(statusCode = 401)) }
        model.onEvent(HostDetailEvent.Load("expired-offer", SearchOfferType.Host))
        val first = requireNotNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(HostDetailEvent.Retry)
        model.onEvent(HostDetailEvent.Load("another-offer", SearchOfferType.Host))

        assertEquals(first, model.state.value.pendingSessionInvalidation)
        assertEquals(listOf("expired-offer"), repository.offerIDs)
        assertTrue(repository.profileUsernames.isEmpty())
        assertEquals(0, repository.membershipCalls)
    }

    @Test fun sessionReplacementCancelsOldWorkAndReloadsTheCurrentRoute() = withModel { model, repository ->
        val late = CompletableDeferred<Result<HostOffer>>()
        repository.offerHandler = { call, id ->
            if (call == 1) withContext(NonCancellable) { late.await() }
            else Result.success(offerFixture(id))
        }
        model.onEvent(HostDetailEvent.Load("current-route-offer", SearchOfferType.Host))
        repository.sessionChanged = true
        model.updateClientAndSession(
            org.trustroots.android.api.MobileApiClient("https://api.example.test"),
            MemberSession("connect.sid=second-fictional-session", MobileMember("second-owl", "Second Owl")),
        )
        late.complete(Result.success(offerFixture("stale-account-offer")))

        assertEquals(listOf("current-route-offer", "current-route-offer"), repository.offerIDs)
        assertEquals("current-route-offer", model.state.value.offer?.id)
    }

    private fun withModel(test: (HostDetailViewModel, FakeRepository) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeRepository()
        try {
            test(HostDetailViewModel(repository, scope), repository)
        } finally {
            scope.cancel()
        }
    }

    private class FakeRepository : HostDetailRepository {
        val offerIDs = mutableListOf<String>()
        val profileUsernames = mutableListOf<String>()
        var membershipCalls = 0
        var sessionChanged = false
        var offerHandler: suspend (Int, String) -> Result<HostOffer> = { _, id -> Result.success(offerFixture(id)) }

        override fun updateClientAndSession(api: org.trustroots.android.api.MobileApiClient, session: MemberSession) =
            sessionChanged.also { sessionChanged = false }

        override suspend fun offer(offerID: String): Result<HostOffer> {
            offerIDs += offerID
            return offerHandler(offerIDs.size, offerID)
        }

        override suspend fun profile(username: String): Result<MemberProfile> {
            profileUsernames += username
            return Result.success(
                MemberProfile(null, username, "Anonymous Host", "A fictional host", null, null, languages = emptyList()),
            )
        }

        override suspend fun memberships(): Result<Set<String>> {
            membershipCalls++
            return Result.success(setOf("circle-one"))
        }
    }

    private companion object {
        fun offerFixture(id: String) = HostOffer(
            id = id,
            status = "yes",
            description = "A fictional room",
            maxGuests = 2,
            user = MessageMember("anonymous-member-id", "host-owl", "Anonymous Host"),
        )
    }
}
