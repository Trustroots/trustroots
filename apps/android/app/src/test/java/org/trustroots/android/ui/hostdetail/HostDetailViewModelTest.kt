package org.trustroots.android.ui.hostdetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.search.SearchOfferType

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class HostDetailViewModelTest {
    @Test fun repositoryDefaultEnvironmentUpdateDoesNotReplaceTheCurrentClient() {
        val repository = object : HostDetailRepository by FakeRepository() {
            override fun updateClientAndSession(api: MobileApiClient, session: MemberSession): Boolean =
                super<HostDetailRepository>.updateClientAndSession(api, session)
        }

        assertFalse(
            repository.updateClientAndSession(
                MobileApiClient("https://api.example.test"),
                MemberSession("fictional-cookie", MobileMember("quiet-fox", "Quiet Fox")),
            ),
        )
    }

    @Test fun mobileRepositoryDetectsBackendCookieAndAccountChangesIndependently() {
        val originalApi = MobileApiClient("https://api.example.test")
        val originalSession = MemberSession("connect.sid=first", MobileMember("quiet-fox", "Quiet Fox"))
        val repository = MobileHostDetailRepository(originalApi, originalSession)

        assertFalse(repository.updateClientAndSession(originalApi, originalSession))
        assertTrue(
            repository.updateClientAndSession(
                MobileApiClient("https://alternate.example.test"),
                originalSession,
            ),
        )
        assertTrue(
            repository.updateClientAndSession(
                MobileApiClient("https://alternate.example.test"),
                MemberSession("connect.sid=second", originalSession.member),
            ),
        )
        assertTrue(
            repository.updateClientAndSession(
                MobileApiClient("https://alternate.example.test"),
                MemberSession("connect.sid=second", MobileMember("steady-owl", "Steady Owl")),
            ),
        )
        assertFalse(
            repository.updateClientAndSession(
                MobileApiClient("https://alternate.example.test"),
                MemberSession("connect.sid=second", MobileMember("steady-owl", "Steady Owl")),
            ),
        )
    }

    @Test fun factoryRejectsAnUnrelatedViewModelType() {
        val failure = runCatching {
            HostDetailViewModel.Factory(FakeRepository()).create(OtherViewModel::class.java)
        }.exceptionOrNull()

        assertTrue(failure is IllegalArgumentException)
    }

    @Test fun retryBeforeAHostRouteIsLoadedDoesNotIssueARequest() = withModel { model, repository ->
        model.onEvent(HostDetailEvent.Retry)

        assertTrue(repository.offerIDs.isEmpty())
        assertEquals(HostDetailUiState(), model.state.value)
    }

    @Test fun invalidationAcknowledgementWithoutPendingInvalidationLeavesDetailUnchanged() = withModel { model, repository ->
        val before = model.state.value

        model.onEvent(HostDetailEvent.SessionInvalidationDelivered(1L))

        assertEquals(before, model.state.value)
        assertTrue(repository.offerIDs.isEmpty())
    }

    @Test fun unchangedEnvironmentDoesNotReloadTheSelectedHost() = withModel { model, repository ->
        model.onEvent(HostDetailEvent.Load("stable-route-offer", SearchOfferType.Host))
        val before = model.state.value
        repository.offerIDs.clear()
        repository.profileUsernames.clear()
        repository.membershipCalls = 0

        model.updateClientAndSession(
            MobileApiClient("https://api.example.test/"),
            MemberSession("connect.sid=unchanged", MobileMember("member-self", "Member Self")),
        )

        assertEquals(before, model.state.value)
        assertTrue(repository.offerIDs.isEmpty())
        assertTrue(repository.profileUsernames.isEmpty())
        assertEquals(0, repository.membershipCalls)
    }

    @Test fun environmentRefreshBeforeTheFirstRouteKeepsTheDetailEmpty() = withModel { model, repository ->
        repository.sessionChanged = true

        model.updateClientAndSession(
            MobileApiClient("https://alternate.example.test"),
            MemberSession("connect.sid=fresh-session", MobileMember("steady-heron", "Steady Heron")),
        )

        assertEquals(HostDetailUiState(), model.state.value)
        assertTrue(repository.offerIDs.isEmpty())
        assertTrue(repository.profileUsernames.isEmpty())
        assertEquals(0, repository.membershipCalls)
    }

    @Test fun blankAndRepeatedRouteLoadsDoNotDuplicateDetailRequests() = withModel { model, repository ->
        val pendingOffer = CompletableDeferred<Result<HostOffer>>()
        repository.offerHandler = { call, id ->
            if (call == 1) withContext(NonCancellable) { pendingOffer.await() }
            else Result.success(offerFixture(id))
        }

        model.onEvent(HostDetailEvent.Load("", SearchOfferType.Host))
        assertTrue(repository.offerIDs.isEmpty())
        model.onEvent(HostDetailEvent.Load("one-route-offer", SearchOfferType.Host))
        model.updateClientAndSession(
            MobileApiClient("https://api.example.test"),
            MemberSession("connect.sid=unchanged", MobileMember("member-self", "Member Self")),
        )
        model.onEvent(HostDetailEvent.Load("one-route-offer", SearchOfferType.Host))
        assertEquals(listOf("one-route-offer"), repository.offerIDs)

        pendingOffer.complete(Result.success(offerFixture("one-route-offer")))
        model.onEvent(HostDetailEvent.Load("one-route-offer", SearchOfferType.Host))

        assertEquals(listOf("one-route-offer"), repository.offerIDs)
        assertEquals("one-route-offer", model.state.value.offer?.id)
        assertEquals(1, repository.profileUsernames.size)
        assertEquals(1, repository.membershipCalls)
    }

    @Test fun sameOfferIdentifierWithDifferentOfferTypeLoadsTheNewRouteContext() = withModel { model, repository ->
        model.onEvent(HostDetailEvent.Load("shared-route-offer", SearchOfferType.Host))
        model.onEvent(HostDetailEvent.Load("shared-route-offer", SearchOfferType.Meet))

        assertEquals(listOf("shared-route-offer", "shared-route-offer"), repository.offerIDs)
        assertEquals(SearchOfferType.Meet, model.state.value.offerType)
        assertEquals("shared-route-offer", model.state.value.offer?.id)
        assertEquals(2, repository.profileUsernames.size)
        assertEquals(2, repository.membershipCalls)
    }

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

    @Test fun repeatingTheFailedRouteDoesNotRetryUntilRetryIsRequested() = withModel { model, repository ->
        repository.offerHandler = { call, id ->
            if (call == 1) Result.failure(IllegalStateException("temporary detail failure"))
            else Result.success(offerFixture(id))
        }

        model.onEvent(HostDetailEvent.Load("retry-offer", SearchOfferType.Host))
        model.onEvent(HostDetailEvent.Load("retry-offer", SearchOfferType.Host))

        assertEquals(listOf("retry-offer"), repository.offerIDs)
        assertTrue(model.state.value.failure != null)
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

    @Test fun reentrantRouteChangeDuringOfferReadKeepsTheNewDetail() = withModel { model, repository ->
        repository.offerHandler = { call, id ->
            if (call == 1) {
                model.onEvent(HostDetailEvent.Load("reentrant-current-offer", SearchOfferType.Meet))
                Result.success(offerFixture(id))
            } else Result.success(offerFixture(id))
        }

        model.onEvent(HostDetailEvent.Load("reentrant-old-offer", SearchOfferType.Host))

        assertEquals(listOf("reentrant-old-offer", "reentrant-current-offer"), repository.offerIDs)
        assertEquals("reentrant-current-offer", model.state.value.offerID)
        assertEquals("reentrant-current-offer", model.state.value.offer?.id)
        assertEquals(SearchOfferType.Meet, model.state.value.offerType)
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

    @Test fun profileFailureKeepsCanonicalOfferAndMembershipsAndRetryReloadsTheDetail() = withModel { model, repository ->
        repository.profileHandler = { call, username ->
            if (call == 1) Result.failure(IOException("Temporary profile failure"))
            else Result.success(profile(username))
        }

        model.onEvent(HostDetailEvent.Load("canonical-offer", SearchOfferType.Host))

        assertEquals("canonical-offer", model.state.value.offer?.id)
        assertNull(model.state.value.profile)
        assertEquals(setOf("circle-one"), model.state.value.sharedCircleIDs)
        assertEquals(UiFailureFallback.LOAD_PROFILE, model.state.value.failure?.fallback)
        model.onEvent(HostDetailEvent.Retry)

        assertEquals(listOf("canonical-offer", "canonical-offer"), repository.offerIDs)
        assertEquals(listOf("host-owl", "host-owl"), repository.profileUsernames)
        assertEquals(2, repository.membershipCalls)
        assertEquals("host-owl", model.state.value.profile?.username)
        assertNull(model.state.value.failure)
    }

    @Test fun expiredProfileSessionInvalidatesOnceAndSkipsMembershipRead() = withModel { model, repository ->
        repository.profileHandler = { _, _ -> Result.failure(MobileApiException(401, "Expired")) }

        model.onEvent(HostDetailEvent.Load("canonical-offer", SearchOfferType.Host))
        val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(HostDetailEvent.Retry)
        model.onEvent(HostDetailEvent.Load("another-offer", SearchOfferType.Meet))

        assertEquals(invalidation, model.state.value.pendingSessionInvalidation)
        assertEquals(listOf("canonical-offer"), repository.offerIDs)
        assertEquals(listOf("host-owl"), repository.profileUsernames)
        assertEquals(0, repository.membershipCalls)
        assertNull(model.state.value.failure)
    }

    @Test fun offerWithoutUsernameKeepsOfferAndSkipsProfileAndMembershipRequests() = withModel { model, repository ->
        repository.offerHandler = { _, id ->
            Result.success(offerFixture(id).copy(user = MessageMember("anonymous-member-id", null, "Anonymous Host")))
        }

        model.onEvent(HostDetailEvent.Load("offer-without-username", SearchOfferType.Host))

        assertEquals("offer-without-username", model.state.value.offer?.id)
        assertNull(model.state.value.profile)
        assertTrue(model.state.value.sharedCircleIDs.isEmpty())
        assertEquals(emptyList<String>(), repository.profileUsernames)
        assertEquals(0, repository.membershipCalls)
        assertFalse(model.state.value.isLoading)
        assertNull(model.state.value.failure)
    }

    @Test fun membershipFailurePreservesOfferAndProfileAndRetryAcceptsAnEmptyMembershipSet() = withModel { model, repository ->
        repository.membershipHandler = { call ->
            if (call == 1) {
                Result.failure(
                    MobileApiException(
                        statusCode = 503,
                        serverMessage = "  ",
                        failureKind = ApiFailureKind.REQUEST_REJECTED,
                    ),
                )
            } else if (call == 2) throw IOException("Temporary membership lookup failure.")
            else Result.success(emptySet())
        }

        model.onEvent(HostDetailEvent.Load("membership-retry-offer", SearchOfferType.Host))

        assertEquals("membership-retry-offer", model.state.value.offer?.id)
        assertEquals("host-owl", model.state.value.profile?.username)
        assertEquals(UiFailure(apiKind = ApiFailureKind.REQUEST_REJECTED, fallback = UiFailureFallback.CIRCLE_MEMBERSHIPS_LOAD), model.state.value.failure)
        assertFalse(model.state.value.isLoading)

        model.onEvent(HostDetailEvent.Retry)
        assertEquals(UiFailure(fallback = UiFailureFallback.CIRCLE_MEMBERSHIPS_LOAD), model.state.value.failure)
        assertEquals("host-owl", model.state.value.profile?.username)

        model.onEvent(HostDetailEvent.Retry)

        assertEquals(3, repository.membershipCalls)
        assertTrue(model.state.value.sharedCircleIDs.isEmpty())
        assertNull(model.state.value.failure)
        assertFalse(model.state.value.isLoading)
    }

    @Test fun membershipAuthenticationFailureKeepsDetailAndInvalidatesOnlyOnce() = withModel { model, repository ->
        repository.membershipHandler = { Result.failure(MobileApiException(401, "Fictional session expired.")) }

        model.onEvent(HostDetailEvent.Load("membership-auth-offer", SearchOfferType.Meet))
        val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(HostDetailEvent.SessionInvalidationDelivered(invalidation.id + 1))
        model.onEvent(HostDetailEvent.Retry)
        model.onEvent(HostDetailEvent.Load("another-offer", SearchOfferType.Host))

        assertEquals(invalidation, model.state.value.pendingSessionInvalidation)
        assertEquals("membership-auth-offer", model.state.value.offer?.id)
        assertEquals("host-owl", model.state.value.profile?.username)
        assertNull(model.state.value.failure)
        assertEquals(listOf("membership-auth-offer"), repository.offerIDs)
        assertEquals(1, repository.membershipCalls)

        model.onEvent(HostDetailEvent.SessionInvalidationDelivered(invalidation.id))
        assertNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(HostDetailEvent.Retry)
        assertEquals(1, repository.offerIDs.size)
    }

    @Test fun profileFromAnEarlierSelectionCannotReplaceTheCurrentHost() = withModel { model, repository ->
        val oldProfile = CompletableDeferred<Result<MemberProfile>>()
        repository.offerHandler = { _, id ->
            Result.success(offerFixture(id, if (id == "old-offer") "old-owl" else "current-owl"))
        }
        repository.profileHandler = { _, username ->
            if (username == "old-owl") withContext(NonCancellable) { oldProfile.await() }
            else Result.success(profile(username))
        }

        model.onEvent(HostDetailEvent.Load("old-offer", SearchOfferType.Host))
        model.onEvent(HostDetailEvent.Load("current-offer", SearchOfferType.Meet))
        oldProfile.complete(Result.success(profile("old-owl")))

        assertEquals("current-offer", model.state.value.offer?.id)
        assertEquals("current-owl", model.state.value.profile?.username)
        assertEquals(setOf("circle-one"), model.state.value.sharedCircleIDs)
        assertEquals(listOf("old-owl", "current-owl"), repository.profileUsernames)
    }

    @Test fun membershipFailureForAnEarlierSelectionCannotReplaceCurrentCircleAccess() = withModel { model, repository ->
        val oldMemberships = CompletableDeferred<Result<Set<String>>>()
        repository.offerHandler = { _, id ->
            Result.success(offerFixture(id, if (id == "old-offer") "old-owl" else "current-owl"))
        }
        repository.membershipHandler = { call ->
            if (call == 1) withContext(NonCancellable) { oldMemberships.await() }
            else Result.success(setOf("current-circle"))
        }

        model.onEvent(HostDetailEvent.Load("old-offer", SearchOfferType.Host))
        model.onEvent(HostDetailEvent.Load("current-offer", SearchOfferType.Meet))
        oldMemberships.complete(Result.success(setOf("stale-circle")))

        assertEquals("current-offer", model.state.value.offer?.id)
        assertEquals("current-owl", model.state.value.profile?.username)
        assertEquals(setOf("current-circle"), model.state.value.sharedCircleIDs)
        assertEquals(2, repository.membershipCalls)
    }

    @Test fun membershipsReturnedByThePreviousRouteCannotReplaceCurrentRouteData() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeRepository()
        lateinit var model: HostDetailViewModel
        model = HostDetailViewModel(repository, scope)
        repository.membershipHandler = { call ->
            if (call == 1) {
                model.onEvent(HostDetailEvent.Load("current-offer", SearchOfferType.Meet))
                Result.success(setOf("stale-circle"))
            } else {
                Result.success(setOf("current-circle"))
            }
        }
        try {
            model.onEvent(HostDetailEvent.Load("previous-offer", SearchOfferType.Host))

            assertEquals("current-offer", model.state.value.offerID)
            assertEquals("current-offer", model.state.value.offer?.id)
            assertEquals(setOf("current-circle"), model.state.value.sharedCircleIDs)
            assertEquals(2, repository.membershipCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test fun clearingTheEntryCancelsAnInFlightDetailRequest() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeRepository()
        var cancelled = false
        repository.offerHandler = { _, _ ->
            try {
                awaitCancellation()
            } finally {
                cancelled = true
            }
        }
        val store = ViewModelStore()
        try {
            val model = ViewModelProvider(
                object : ViewModelStoreOwner { override val viewModelStore = store },
                HostDetailViewModel.Factory(repository, scope),
            ).get(HostDetailViewModel::class.java)
            model.onEvent(HostDetailEvent.Load("pending-offer", SearchOfferType.Host))
            assertTrue(model.state.value.isLoading)

            store.clear()

            assertTrue(cancelled)
            assertTrue(repository.profileUsernames.isEmpty())
            assertEquals(0, repository.membershipCalls)
        } finally {
            store.clear()
            scope.cancel()
        }
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
        var membershipHandler: suspend (Int) -> Result<Set<String>> = { Result.success(setOf("circle-one")) }
        var sessionChanged = false
        var offerHandler: suspend (Int, String) -> Result<HostOffer> = { _, id -> Result.success(offerFixture(id)) }
        var profileHandler: suspend (Int, String) -> Result<MemberProfile> = { _, username ->
            Result.success(HostDetailViewModelTest.profile(username))
        }

        override fun updateClientAndSession(api: org.trustroots.android.api.MobileApiClient, session: MemberSession) =
            sessionChanged.also { sessionChanged = false }

        override suspend fun offer(offerID: String): Result<HostOffer> {
            offerIDs += offerID
            return offerHandler(offerIDs.size, offerID)
        }

        override suspend fun profile(username: String): Result<MemberProfile> {
            profileUsernames += username
            return profileHandler(profileUsernames.size, username)
        }

        override suspend fun memberships(): Result<Set<String>> {
            membershipCalls++
            return membershipHandler(membershipCalls)
        }
    }

    private class OtherViewModel : ViewModel()

    private companion object {
        fun offerFixture(id: String, username: String = "host-owl") = HostOffer(
            id = id,
            status = "yes",
            description = "A fictional room",
            maxGuests = 2,
            user = MessageMember("anonymous-member-id", username, "Anonymous Host"),
        )
        fun profile(username: String) = MemberProfile(null, username, "Anonymous Host", "A fictional host", null, null, languages = emptyList())
    }
}
