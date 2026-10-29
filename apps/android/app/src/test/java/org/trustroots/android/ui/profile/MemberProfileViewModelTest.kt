package org.trustroots.android.ui.profile

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
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
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import java.io.IOException
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberProfileViewModelTest {
    @Test
    fun repositoryDefaultsTreatAnEnvironmentUpdateAsUnchanged() {
        val repository = object : MemberProfileRepository by FakeMemberProfileRepository() {
            override fun updateApi(api: MobileApiClient): Boolean =
                super<MemberProfileRepository>.updateApi(api)

            override fun updateSession(session: MemberSession): Boolean =
                super<MemberProfileRepository>.updateSession(session)
        }

        assertFalse(repository.updateApi(MobileApiClient("https://api.example.test")))
        assertFalse(repository.updateSession(MemberSession("fictional-cookie", org.trustroots.android.api.MobileMember("quiet-fox", "Quiet Fox"))))
    }

    @Test
    fun loadsProfileAndRelatedSectionsIntoImmutableEntryState() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(model.state.value.hostingLoaded)
        assertEquals("offer-fox", model.state.value.hosting?.id)
        assertEquals(listOf("steady-owl"), model.state.value.contacts.map { it.user.username })
        assertEquals(listOf("reference-owl"), model.state.value.references.map { it.author.username })
        assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun safetyEventsBeforeProfileLoadsDoNotStartMemberRequests() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingProfile = CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeMemberProfileRepository().apply {
            profileHandler = { withContext(NonCancellable) { pendingProfile.await() } }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            assertNull(model.state.value.profile)

            model.onEvent(MemberProfileEvent.RetryBlockStatus)
            model.onEvent(MemberProfileEvent.SetBlocked(true))
            model.onEvent(MemberProfileEvent.ReportDraftChanged("A fictional report before profile load."))
            model.onEvent(MemberProfileEvent.SubmitReport)

            assertEquals(0, repository.blockedMembersCalls)
            assertTrue(repository.blockChanges.isEmpty())
            assertTrue(repository.reports.isEmpty())
            assertFalse(model.state.value.isSubmittingReport)

            pendingProfile.complete(Result.success(profile("quiet-fox", "Quiet Fox")))
            assertEquals("Quiet Fox", model.state.value.profile?.displayName)
            assertEquals(1, repository.blockedMembersCalls)
            assertTrue(repository.blockChanges.isEmpty())
            assertTrue(repository.reports.isEmpty())
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun loadsBlockStatusByIDOrCaseInsensitiveUsernameEvenWithoutProfileID() {
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(listOf(MessageMember(null, "QUIET-FOX", "Quiet Fox")))
            profileResult = Result.success(profile("quiet-fox", "Quiet Fox").copy(id = null))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertTrue(state.isBlocked == true)
        assertFalse(state.isLoadingBlock)
        assertNull(state.blockFailure)
        assertEquals(1, repository.blockedMembersCalls)
        assertEquals(0, repository.hostingCalls)
    }

    @Test
    fun blockStatusFallsBackToUsernameWhenProfileHasNoIDAndBlockedEntryHasAnotherID() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Quiet Fox").copy(id = null))
            blockedMembersResult = Result.success(listOf(MessageMember("another-member", "QUIET-FOX", "Quiet Fox")))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertEquals(true, state.isBlocked)
        assertFalse(state.isLoadingBlock)
        assertNull(state.blockFailure)
        assertEquals(1, repository.blockedMembersCalls)
    }

    @Test
    fun failedBlockStatusRemainsUnknownAndCanBeRetried() {
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.failure(IOException("Temporary block lookup failure"))
        }
        val model = newModel("quiet-fox", repository)

        assertNull(model.state.value.isBlocked)
        assertFalse(model.state.value.isLoadingBlock)
        assertEquals(MemberProfileFailureReason.BLOCK_STATUS, model.state.value.blockFailure?.reason)
        model.onEvent(MemberProfileEvent.SetBlocked(true))
        assertTrue(repository.blockChanges.isEmpty())

        repository.blockedMembersResult = Result.success(listOf(MessageMember("member-quiet-fox", "quiet-fox", "Quiet Fox")))
        model.onEvent(MemberProfileEvent.RetryBlockStatus)

        assertEquals(true, model.state.value.isBlocked)
        assertNull(model.state.value.blockFailure)
        assertEquals(2, repository.blockedMembersCalls)
    }

    @Test
    fun blockStatusLookupGuardsRetriesAndMutationsUntilTheLookupFinishes() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingLookup = CompletableDeferred<Result<List<MessageMember>>>()
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersHandler = { call ->
                if (call == 1) withContext(NonCancellable) { pendingLookup.await() }
                else Result.success(emptyList())
            }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)

            model.onEvent(MemberProfileEvent.RetryBlockStatus)
            model.onEvent(MemberProfileEvent.RetryBlockStatus)
            model.onEvent(MemberProfileEvent.SetBlocked(true))

            assertTrue(model.state.value.isLoadingBlock)
            assertEquals(1, repository.blockedMembersCalls)
            assertTrue(repository.blockChanges.isEmpty())

            pendingLookup.complete(Result.success(listOf(MessageMember("member-quiet-fox", "another-name", "Quiet Fox"))))

            assertEquals(true, model.state.value.isBlocked)
            assertFalse(model.state.value.isLoadingBlock)
            assertTrue(repository.blockChanges.isEmpty())
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun blockStatusMatchesMemberIDBeforeUsernameAndFallsBackToUsername() {
        val idMatchRepository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(listOf(MessageMember("member-quiet-fox", "different-name", "Quiet Fox")))
        }
        assertEquals(true, newModel("quiet-fox", idMatchRepository).state.value.isBlocked)

        val usernameMatchRepository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(listOf(MessageMember(null, "QUIET-FOX", "Quiet Fox")))
        }
        assertEquals(true, newModel("quiet-fox", usernameMatchRepository).state.value.isBlocked)

        val differentIDUsernameMatchRepository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(listOf(MessageMember("another-member", "QUIET-FOX", "Quiet Fox")))
        }
        assertEquals(true, newModel("quiet-fox", differentIDUsernameMatchRepository).state.value.isBlocked)

        val mismatchRepository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(listOf(MessageMember("another-member", null, "Someone Else")))
        }
        assertEquals(false, newModel("quiet-fox", mismatchRepository).state.value.isBlocked)

        val differentUsernameRepository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(listOf(MessageMember("another-member", "unrelated-owl", "Unrelated Owl")))
        }
        assertEquals(false, newModel("quiet-fox", differentUsernameRepository).state.value.isBlocked)

        val missingIdentityRepository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Quiet Fox").copy(id = null))
            blockedMembersResult = Result.success(listOf(MessageMember("another-member", null, "Someone Else")))
        }
        assertEquals(false, newModel("quiet-fox", missingIdentityRepository).state.value.isBlocked)
    }

    @Test
    fun unidentifiedBlockedMemberDoesNotMatchAProfileWithKnownID() {
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(listOf(MessageMember(null, null, "Unidentified member")))
        }

        assertEquals(false, newModel("quiet-fox", repository).state.value.isBlocked)
    }

    @Test
    fun blockMutationIsIgnoredWhileRefreshingKnownStatus() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingLookup = CompletableDeferred<Result<List<MessageMember>>>()
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(emptyList())
            blockedMembersHandler = { call ->
                if (call == 2) withContext(NonCancellable) { pendingLookup.await() }
                else Result.success(emptyList())
            }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            assertEquals(false, model.state.value.isBlocked)

            model.onEvent(MemberProfileEvent.RetryBlockStatus)
            model.onEvent(MemberProfileEvent.SetBlocked(true))

            assertTrue(model.state.value.isLoadingBlock)
            assertEquals(false, model.state.value.isBlocked)
            assertTrue(repository.blockChanges.isEmpty())

            pendingLookup.complete(Result.success(listOf(MessageMember("member-quiet-fox", "quiet-fox", "Quiet Fox"))))
            assertEquals(true, model.state.value.isBlocked)
            assertTrue(repository.blockChanges.isEmpty())
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun reportAuthenticationFailureClearsPendingBlockStatusAndRejectsItsLateResult() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingBlockStatus = CompletableDeferred<Result<List<MessageMember>>>()
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersHandler = { withContext(NonCancellable) { pendingBlockStatus.await() } }
            reportResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            assertTrue(model.state.value.isLoadingBlock)
            model.onEvent(MemberProfileEvent.ReportDraftChanged("A fictional report."))

            model.onEvent(MemberProfileEvent.SubmitReport)
            val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)
            assertFalse(model.state.value.isLoadingBlock)

            pendingBlockStatus.complete(
                Result.success(listOf(MessageMember("member-quiet-fox", "quiet-fox", "Quiet Fox"))),
            )

            assertEquals(invalidation, model.state.value.pendingSessionInvalidation)
            assertNull(model.state.value.isBlocked)
            assertFalse(model.state.value.isLoadingBlock)
            assertEquals(1, repository.blockedMembersCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun factoryRejectsUnrelatedViewModelTypes() {
        val factory = MemberProfileViewModel.Factory("quiet-fox", "member-self", FakeMemberProfileRepository())

        val failure = runCatching { factory.create(UnrelatedViewModel::class.java) }.exceptionOrNull()

        assertTrue(failure is IllegalArgumentException)
    }

    @Test
    fun reportDraftAndDismissEventsAreIgnoredWhileSubmissionIsPending() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingReport = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            reportHandler = { _, _ -> withContext(NonCancellable) { pendingReport.await() } }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ReportDraftChanged("Original fictional report."))
            model.onEvent(MemberProfileEvent.SubmitReport)

            model.onEvent(MemberProfileEvent.ReportDraftChanged("Changed while pending."))
            model.onEvent(MemberProfileEvent.DismissReport)

            assertTrue(model.state.value.isSubmittingReport)
            assertEquals("Original fictional report.", model.state.value.reportDraft)
            assertEquals(listOf("quiet-fox" to "Original fictional report."), repository.reports)

            pendingReport.complete(Result.success(Unit))
            model.onEvent(MemberProfileEvent.DismissReport)
            assertEquals("", model.state.value.reportDraft)
            assertFalse(model.state.value.reportSubmitted)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun staleBlockStatusResponseIsIgnoredAfterEnvironmentRefresh() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val staleLookup = CompletableDeferred<Result<List<MessageMember>>>()
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersHandler = { call ->
                if (call == 1) withContext(NonCancellable) { staleLookup.await() }
                else Result.success(emptyList())
            }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            assertTrue(model.state.value.isLoadingBlock)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=another-fictional-session", MobileMember("different-member", "Different Member")),
            )
            assertEquals(false, model.state.value.isBlocked)
            staleLookup.complete(Result.success(listOf(MessageMember("member-quiet-fox", "quiet-fox", "Quiet Fox"))))

            assertEquals(false, model.state.value.isBlocked)
            assertEquals(2, repository.blockedMembersCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun synchronousEnvironmentRefreshDuringReportCannotPublishTheOldSuccess() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeMemberProfileRepository()
        lateinit var model: MemberProfileViewModel
        repository.reportHandler = { _, _ ->
            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=refreshed-fictional-session", MobileMember("member-self", "Member Self")),
            )
            Result.success(Unit)
        }
        try {
            model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ReportDraftChanged("A fictional report."))

            model.onEvent(MemberProfileEvent.SubmitReport)

            assertEquals(1, repository.reports.size)
            assertFalse(model.state.value.isSubmittingReport)
            assertFalse(model.state.value.reportSubmitted)
            assertEquals("Quiet Fox", model.state.value.profile?.displayName)
            assertEquals("", model.state.value.reportDraft)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun blockMutationPreservesKnownStateOnFailureAndUpdatesOnlyAfterSuccess() {
        val repository = FakeMemberProfileRepository().apply {
            setBlockedHandler = { _, blocked ->
                if (blocked) Result.failure(IOException("Temporary block failure")) else Result.success(Unit)
            }
        }
        val model = newModel("quiet-fox", repository)

        model.onEvent(MemberProfileEvent.SetBlocked(true))
        assertEquals(false, model.state.value.isBlocked)
        assertFalse(model.state.value.isUpdatingBlock)
        assertEquals(MemberProfileFailureReason.BLOCK_UPDATE, model.state.value.blockFailure?.reason)

        repository.setBlockedHandler = null
        model.onEvent(MemberProfileEvent.SetBlocked(true))
        assertEquals(true, model.state.value.isBlocked)
        assertNull(model.state.value.blockFailure)
        assertEquals(listOf("quiet-fox" to true, "quiet-fox" to true), repository.blockChanges)
    }

    @Test
    fun settingBlockStateToItsCurrentValueDoesNotSendAMutation() {
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(emptyList())
        }
        val model = newModel("quiet-fox", repository)

        assertEquals(false, model.state.value.isBlocked)
        model.onEvent(MemberProfileEvent.SetBlocked(false))

        assertTrue(repository.blockChanges.isEmpty())
        assertFalse(model.state.value.isUpdatingBlock)
        assertEquals(false, model.state.value.isBlocked)
    }

    @Test
    fun inFlightBlockAndReportRequestsCannotBeDuplicatedAndReportUsesTrimmedDraft() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingBlock = CompletableDeferred<Result<Unit>>()
        val pendingReport = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            setBlockedHandler = { _, _ -> withContext(NonCancellable) { pendingBlock.await() } }
            reportHandler = { _, _ -> withContext(NonCancellable) { pendingReport.await() } }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.SetBlocked(true))
            model.onEvent(MemberProfileEvent.SetBlocked(true))
            model.onEvent(MemberProfileEvent.RetryBlockStatus)
            assertTrue(model.state.value.isUpdatingBlock)
            assertEquals(1, repository.blockedMembersCalls)
            assertEquals(listOf("quiet-fox" to true), repository.blockChanges)
            pendingBlock.complete(Result.success(Unit))
            assertEquals(true, model.state.value.isBlocked)

            model.onEvent(MemberProfileEvent.ReportDraftChanged("  A fictional concern.  "))
            model.onEvent(MemberProfileEvent.SubmitReport)
            model.onEvent(MemberProfileEvent.SubmitReport)
            assertTrue(model.state.value.isSubmittingReport)
            assertEquals(listOf("quiet-fox" to "A fictional concern."), repository.reports)
            pendingReport.complete(Result.success(Unit))
            assertTrue(model.state.value.reportSubmitted)
            assertFalse(model.state.value.isSubmittingReport)
            assertEquals("  A fictional concern.  ", model.state.value.reportDraft)
            model.onEvent(MemberProfileEvent.SubmitReport)
            assertEquals(1, repository.reports.size)

            model.onEvent(MemberProfileEvent.DismissReport)
            assertEquals("", model.state.value.reportDraft)
            assertFalse(model.state.value.reportSubmitted)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun reportRequiresNonblankMessageRetainsDraftOnFailureAndCanRetry() {
        val repository = FakeMemberProfileRepository().apply {
            reportResult = Result.failure(MobileApiException(503, "Support is unavailable."))
        }
        val model = newModel("quiet-fox", repository)
        model.onEvent(MemberProfileEvent.ReportDraftChanged("  \n "))
        model.onEvent(MemberProfileEvent.SubmitReport)
        assertTrue(repository.reports.isEmpty())

        model.onEvent(MemberProfileEvent.ReportDraftChanged("  A fictional concern.  "))
        model.onEvent(MemberProfileEvent.SubmitReport)
        assertEquals("  A fictional concern.  ", model.state.value.reportDraft)
        assertEquals(MemberProfileFailureReason.REPORT, model.state.value.reportFailure?.reason)
        assertFalse(model.state.value.reportSubmitted)

        repository.reportResult = Result.success(Unit)
        model.onEvent(MemberProfileEvent.SubmitReport)
        assertTrue(model.state.value.reportSubmitted)
        assertNull(model.state.value.reportFailure)
        assertEquals(2, repository.reports.size)
    }

    @Test
    fun safetyAuthenticationFailureUsesSingleSessionInvalidation() {
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }

        val model = newModel("quiet-fox", repository)

        assertNull(model.state.value.isBlocked)
        assertNull(model.state.value.blockFailure)
        assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
        model.onEvent(MemberProfileEvent.RetryBlockStatus)
        assertEquals(1, repository.blockedMembersCalls)

        val reportRepository = FakeMemberProfileRepository().apply {
            reportResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }
        val reportModel = newModel("quiet-fox", reportRepository)
        reportModel.onEvent(MemberProfileEvent.ReportDraftChanged("A private fictional report."))
        reportModel.onEvent(MemberProfileEvent.SubmitReport)
        assertEquals("", reportModel.state.value.reportDraft)
        assertFalse(reportModel.state.value.isSubmittingReport)
        assertNull(reportModel.state.value.reportFailure)
        assertEquals(1L, reportModel.state.value.pendingSessionInvalidation?.id)
    }

    @Test
    fun blockAuthenticationFailureInvalidatesSessionAndIgnoresPendingReportResult() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingReport = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            reportHandler = { _, _ -> withContext(NonCancellable) { pendingReport.await() } }
            setBlockedHandler = { _, _ -> Result.failure(MobileApiException(401, "Fictional session expired.")) }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ReportDraftChanged("A fictional report."))
            model.onEvent(MemberProfileEvent.SubmitReport)
            assertTrue(model.state.value.isSubmittingReport)

            model.onEvent(MemberProfileEvent.SetBlocked(true))

            assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
            assertFalse(model.state.value.isUpdatingBlock)
            assertFalse(model.state.value.isSubmittingReport)
            assertEquals("", model.state.value.reportDraft)
            assertEquals(listOf("quiet-fox" to true), repository.blockChanges)

            pendingReport.complete(Result.success(Unit))
            model.onEvent(MemberProfileEvent.SetBlocked(true))
            model.onEvent(MemberProfileEvent.ReportDraftChanged("Ignored after authentication failure."))
            model.onEvent(MemberProfileEvent.SubmitReport)

            assertFalse(model.state.value.reportSubmitted)
            assertFalse(model.state.value.isSubmittingReport)
            assertEquals(1, repository.reports.size)
            assertEquals(1, repository.blockChanges.size)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun pendingBlockSuccessCannotRestoreBlockStateAfterReportAuthenticationFailure() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingBlock = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            blockedMembersResult = Result.success(emptyList())
            setBlockedHandler = { _, _ -> withContext(NonCancellable) { pendingBlock.await() } }
            reportHandler = { _, _ -> Result.failure(MobileApiException(401, "Fictional session expired.")) }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            assertEquals(false, model.state.value.isBlocked)

            model.onEvent(MemberProfileEvent.SetBlocked(true))
            assertTrue(model.state.value.isUpdatingBlock)
            model.onEvent(MemberProfileEvent.ReportDraftChanged("A fictional report."))
            model.onEvent(MemberProfileEvent.SubmitReport)

            val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)
            assertFalse(model.state.value.isUpdatingBlock)
            assertFalse(model.state.value.isSubmittingReport)

            pendingBlock.complete(Result.success(Unit))

            assertEquals(false, model.state.value.isBlocked)
            assertFalse(model.state.value.isUpdatingBlock)
            assertEquals(invalidation, model.state.value.pendingSessionInvalidation)
            assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
            assertEquals(listOf("quiet-fox" to true), repository.blockChanges)
            assertEquals(listOf("quiet-fox" to "A fictional report."), repository.reports)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun ownProfileDoesNotLoadOrMutateBlockStateOrSubmitReports() {
        val repository = FakeMemberProfileRepository()
        val model = MemberProfileViewModel(
            username = "QUIET-FOX",
            ownUsername = "quiet-fox",
            repository = repository,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
        )

        assertEquals(0, repository.blockedMembersCalls)
        model.onEvent(MemberProfileEvent.SetBlocked(true))
        model.onEvent(MemberProfileEvent.ReportDraftChanged("A private fictional report."))
        model.onEvent(MemberProfileEvent.SubmitReport)

        assertTrue(repository.blockChanges.isEmpty())
        assertTrue(repository.reports.isEmpty())
        assertNull(model.state.value.isBlocked)
    }

    @Test
    fun accountAndBackendChangesClearSafetyStateAndIgnoreStaleResponses() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingReport = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            reportHandler = { _, _ -> withContext(NonCancellable) { pendingReport.await() } }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ReportDraftChanged("A private fictional report."))
            model.onEvent(MemberProfileEvent.SubmitReport)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=another-fictional-session", MobileMember("different-member", "Different Member")),
            )

            assertEquals("", model.state.value.reportDraft)
            assertFalse(model.state.value.isSubmittingReport)
            assertEquals(false, model.state.value.isBlocked)
            pendingReport.complete(Result.success(Unit))
            assertFalse(model.state.value.reportSubmitted)
            assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun staleBlockMutationCannotChangeStatusAfterAccountAndBackendReload() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingBlock = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            setBlockedHandler = { _, _ -> withContext(NonCancellable) { pendingBlock.await() } }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.SetBlocked(true))
            assertTrue(model.state.value.isUpdatingBlock)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=another-fictional-session", MobileMember("different-member", "Different Member")),
            )
            assertEquals(false, model.state.value.isBlocked)
            pendingBlock.complete(Result.success(Unit))

            assertEquals(false, model.state.value.isBlocked)
            assertFalse(model.state.value.isUpdatingBlock)
            assertNull(model.state.value.blockFailure)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun separateNavigationEntryStoresIsolateRepeatedUsernameVisitsAndClearOnRemoval() {
        val firstStore = ViewModelStore()
        val secondStore = ViewModelStore()
        val firstRepository = FakeMemberProfileRepository()
        val secondRepository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Second Visit"))
        }
        val first = ViewModelProvider(Owner(firstStore), MemberProfileViewModel.Factory(
            "quiet-fox", "member-self", firstRepository,
        ))["MemberProfileViewModel:quiet-fox", MemberProfileViewModel::class.java]
        val second = ViewModelProvider(Owner(secondStore), MemberProfileViewModel.Factory(
            "quiet-fox", "member-self", secondRepository,
        ))["MemberProfileViewModel:quiet-fox", MemberProfileViewModel::class.java]

        assertEquals("Quiet Fox", first.state.value.profile?.displayName)
        assertEquals("Second Visit", second.state.value.profile?.displayName)
        firstStore.clear()

        assertNull(first.state.value.profile)
        assertEquals("Second Visit", second.state.value.profile?.displayName)
        secondStore.clear()
        assertNull(second.state.value.profile)
    }

    @Test
    fun authenticationFailureIsDeliveredOnce() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.failure(MobileApiException(401, "Expired"))
        }
        val model = newModel("quiet-fox", repository)
        val pending = requireNotNull(model.state.value.pendingSessionInvalidation)

        model.onEvent(MemberProfileEvent.SessionInvalidationDelivered(pending.id))

        assertNull(model.state.value.pendingSessionInvalidation)
        assertFalse(model.state.value.isLoading)
        assertTrue(model.state.value.profile == null)
    }

    @Test
    fun nonAuthenticationProfileFailureStopsLoadingAndRetainsUsefulApiDetails() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.failure(
                MobileApiException(
                    statusCode = 503,
                    serverMessage = "  ",
                    failureKind = ApiFailureKind.REQUEST_REJECTED,
                ),
            )
        }

        val state = newModel("quiet-fox", repository).state.value

        assertFalse(state.isLoading)
        assertNull(state.profile)
        assertEquals(
            MemberProfileFailure(
                MemberProfileFailureReason.PROFILE,
                apiKind = ApiFailureKind.REQUEST_REJECTED,
            ),
            state.failure,
        )
        assertNull(state.pendingSessionInvalidation)
        assertEquals(0, repository.hostingCalls)
        assertEquals(0, repository.contactsCalls)
        assertEquals(0, repository.referenceCalls)
        assertEquals(0, repository.relationshipCalls)

        repository.profileResult = Result.failure(
            MobileApiException(
                statusCode = 503,
                serverMessage = "The profile is temporarily unavailable.",
                failureKind = ApiFailureKind.REQUEST_REJECTED,
            ),
        )
        val messageState = newModel("quiet-fox", repository).state.value
        assertEquals("The profile is temporarily unavailable.", messageState.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, messageState.failure?.apiKind)
    }

    @Test
    fun profileWithoutMemberIDKeepsIdentityAndSkipsRelatedRequestsAndActions() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Quiet Fox").copy(id = null))
        }
        val model = newModel("quiet-fox", repository)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertFalse(model.state.value.isLoading)
        assertFalse(model.state.value.hostingLoaded)
        assertFalse(model.state.value.relationshipResolved)
        model.onEvent(MemberProfileEvent.RefreshReferences)
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals(0, repository.hostingCalls)
        assertEquals(0, repository.contactsCalls)
        assertEquals(0, repository.referenceCalls)
        assertEquals(0, repository.relationshipCalls)
        assertTrue(repository.removedContactIDs.isEmpty())
    }

    @Test
    fun viewingOwnProfileSkipsRelationshipAndAccountOrBackendChangesReloadIt() {
        val repository = FakeMemberProfileRepository()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = MemberProfileViewModel("quiet-fox", "quiet-fox", repository, scope)
            assertEquals(1, repository.profileCalls)
            assertEquals(0, repository.relationshipCalls)
            assertFalse(model.state.value.relationshipResolved)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:1"),
                MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self")),
            )
            assertEquals(2, repository.profileCalls)
            assertEquals(1, repository.relationshipCalls)
            assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self")),
            )
            assertEquals(3, repository.profileCalls)
            assertEquals(2, repository.relationshipCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun parallelSectionAuthenticationFailuresShareOneInvalidation() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            contactsResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            referencesResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            relationshipResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertEquals(1L, state.pendingSessionInvalidation?.id)
        assertFalse(state.isLoading)
        assertTrue(state.hostingLoaded)
        assertEquals(1, repository.hostingCalls)
        assertEquals(1, repository.contactsCalls)
        assertEquals(1, repository.referenceCalls)
        assertEquals(1, repository.relationshipCalls)
    }

    @Test
    fun hostingAuthenticationFailureCompletesSectionAndPreservesProfile() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }
        val model = newModel("quiet-fox", repository)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(model.state.value.hostingLoaded)
        assertNull(model.state.value.hosting)
        assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun nonAuthenticationHostingFailureCompletesSectionWithoutInvalidatingSession() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(IOException("Temporary hosting failure"))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertEquals("Quiet Fox", state.profile?.displayName)
        assertTrue(state.hostingLoaded)
        assertNull(state.hosting)
        assertNull(state.pendingSessionInvalidation)
    }

    @Test
    fun contactSectionFailurePreservesProfileAndOnlyAuthenticationFailureInvalidatesSession() {
        val repository = FakeMemberProfileRepository().apply {
            contactsResult = Result.failure(IOException("Temporary contacts failure"))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = newModel("quiet-fox", repository, scope)

            assertEquals("Quiet Fox", model.state.value.profile?.displayName)
            assertTrue(model.state.value.contacts.isEmpty())
            assertNull(model.state.value.pendingSessionInvalidation)

            repository.contactsResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:1"),
                MemberSession("connect.sid=refreshed-fictional-session", MobileMember("member-self", "Member Self")),
            )

            assertEquals("Quiet Fox", model.state.value.profile?.displayName)
            assertTrue(model.state.value.contacts.isEmpty())
            assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun renewedCredentialsCancelOldLoadAndIgnoreItsLateProfile() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val oldProfile = CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeMemberProfileRepository().apply {
            profileHandler = {
                if (profileCalls == 1) withContext(NonCancellable) { oldProfile.await() }
                else Result.success(profile("quiet-fox", "Renewed Profile"))
            }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            assertTrue(model.state.value.isLoading)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:1"),
                MemberSession("connect.sid=renewed-fictional-session", MobileMember("quiet-fox", "Quiet Fox")),
            )

            assertEquals("connect.sid=renewed-fictional-session", repository.currentCookie)
            assertEquals("Renewed Profile", model.state.value.profile?.displayName)
            oldProfile.complete(Result.success(profile("quiet-fox", "Stale Profile")))

            assertEquals("Renewed Profile", model.state.value.profile?.displayName)
            assertEquals(2, repository.profileCalls)
            assertEquals("Renewed own username is used when deciding whether to load a relationship", 0, repository.relationshipCalls)
            assertFalse(model.state.value.toString().contains("renewed-fictional-session"))
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun recreatedClientForSameBackendKeepsLoadedEntryState() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)
        val recreatedClient = MobileApiClient("http://127.0.0.1:1")

        model.updateEnvironment(
            recreatedClient,
            MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self")),
        )

        assertSame(recreatedClient, repository.currentApi)
        assertEquals(1, repository.profileCalls)
        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(model.state.value.hostingLoaded)
    }

    @Test
    fun repositoryDistinguishesBackendChangeFromNewClientInstance() {
        val session = MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self"))
        val repository = MobileApiMemberProfileRepository(
            MobileApiClient("http://127.0.0.1:1"), session,
        )

        assertFalse(repository.updateApi(MobileApiClient("http://127.0.0.1:1")))
        assertTrue(repository.updateApi(MobileApiClient("http://127.0.0.1:2")))
    }

    @Test
    fun mobileRepositoryDetectsBackendCookieAndAccountIdentityChanges() {
        val originalApi = MobileApiClient("http://127.0.0.1:1")
        val originalSession = MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self"))
        val repository = MobileApiMemberProfileRepository(originalApi, originalSession)

        assertFalse(repository.updateApi(MobileApiClient("http://127.0.0.1:1")))
        assertTrue(repository.updateApi(MobileApiClient("http://127.0.0.1:2")))
        assertFalse(repository.updateSession(originalSession))
        assertTrue(repository.updateSession(MemberSession("connect.sid=refreshed", MobileMember("member-self", "Member Self"))))
        assertTrue(repository.updateSession(MemberSession("connect.sid=refreshed", MobileMember("new-self", "New Self"))))
        assertFalse(repository.updateSession(MemberSession("connect.sid=refreshed", MobileMember("new-self", "New Self"))))
    }

    @Test
    fun referenceRefreshReplacesTheSectionAndRemovalFailureCanBeDismissed() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)

        repository.referencesResult = Result.success(
            listOf(ProfileReference("reference-new", org.trustroots.android.api.MessageMember("new-ref", "new-owl", "New Owl"), "A new fictional note", "yes", null)),
        )
        model.onEvent(MemberProfileEvent.RefreshReferences)
        assertEquals(listOf("new-owl"), model.state.value.references.map { it.author.username })
        assertEquals(2, repository.referenceCalls)

        val savedProfile = profile("quiet-fox", "Updated Quiet Fox")
        model.onEvent(MemberProfileEvent.ProfileSaved(savedProfile))
        assertEquals("Updated Quiet Fox", model.state.value.profile?.displayName)

        repository.removalResult = Result.failure(IOException("Temporary removal failure"))
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)
        assertFalse(model.state.value.isRemovingContact)
        assertEquals(MemberProfileFailureReason.REMOVE_CONTACT, model.state.value.removalFailure?.reason)
        model.onEvent(MemberProfileEvent.DismissRemoveContact)

        assertNull(model.state.value.removalFailure)
        assertFalse(model.state.value.contactRemovalSucceeded)
        assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)

        repository.removalResult = Result.success(Unit)
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals(listOf("relationship-fox", "relationship-fox"), repository.removedContactIDs)
        assertNull(model.state.value.removalFailure)
        assertTrue(model.state.value.contactRemovalSucceeded)
        assertFalse(model.state.value.isRemovingContact)
        assertEquals(ContactRelationship(null, false), model.state.value.relationship)
    }

    @Test
    fun nonAuthenticationReferenceRefreshFailureKeepsPreviouslyLoadedReferences() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)
        val originalReferences = model.state.value.references
        repository.referencesResult = Result.failure(IOException("Temporary references failure"))

        model.onEvent(MemberProfileEvent.RefreshReferences)

        assertEquals(originalReferences, model.state.value.references)
        assertNull(model.state.value.pendingSessionInvalidation)
        assertEquals(2, repository.referenceCalls)
    }

    @Test
    fun newestReferenceRefreshWinsWhenAnOlderRequestCompletesLate() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val staleReferences = CompletableDeferred<Result<List<ProfileReference>>>()
        val repository = FakeMemberProfileRepository().apply {
            referencesHandler = { call ->
                when (call) {
                    2 -> withContext(NonCancellable) { staleReferences.await() }
                    3 -> Result.success(listOf(reference("current-reference", "current-owl")))
                    else -> Result.success(listOf(reference("initial-reference", "initial-owl")))
                }
            }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.RefreshReferences)
            model.onEvent(MemberProfileEvent.RefreshReferences)
            staleReferences.complete(Result.success(listOf(reference("stale-reference", "stale-owl"))))

            assertEquals(listOf("current-owl"), model.state.value.references.map { it.author.username })
            assertEquals(3, repository.referenceCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun inFlightContactRemovalCannotBeDuplicatedAndCompletesWithTheCanonicalRelationship() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingRemoval = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            removalHandler = { withContext(NonCancellable) { pendingRemoval.await() } }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ConfirmRemoveContact)
            model.onEvent(MemberProfileEvent.ConfirmRemoveContact)
            model.onEvent(MemberProfileEvent.DismissRemoveContact)

            assertEquals(listOf("relationship-fox"), repository.removedContactIDs)
            assertTrue(model.state.value.isRemovingContact)
            assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)

            pendingRemoval.complete(Result.success(Unit))

            assertEquals(ContactRelationship(null, false), model.state.value.relationship)
            assertTrue(model.state.value.contactRemovalSucceeded)
            assertFalse(model.state.value.isRemovingContact)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun environmentRefreshDuringRemovalRejectsTheSynchronousOldAuthenticationFailure() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Fresh Profile"))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        lateinit var model: MemberProfileViewModel
        repository.removalHandler = {
            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=rotated-fictional-session", MobileMember("member-self", "Member Self")),
            )
            Result.failure(MobileApiException(401, "Fictional stale session."))
        }
        try {
            model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

            assertEquals("Fresh Profile", model.state.value.profile?.displayName)
            assertNull(model.state.value.pendingSessionInvalidation)
            assertFalse(model.state.value.isRemovingContact)
            assertNull(model.state.value.removalFailure)
            assertEquals(2, repository.profileCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun referenceAuthenticationFailureInvalidatesSessionAndBlocksFurtherRefreshes() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)
        assertEquals(1, repository.referenceCalls)

        repository.referencesResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        model.onEvent(MemberProfileEvent.RefreshReferences)
        val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberProfileEvent.RefreshReferences)
        model.onEvent(MemberProfileEvent.SessionInvalidationDelivered(invalidation.id + 1))

        assertEquals(2, repository.referenceCalls)
        assertEquals(invalidation, model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberProfileEvent.SessionInvalidationDelivered(invalidation.id))
        assertNull(model.state.value.pendingSessionInvalidation)
    }

    @Test
    fun authenticationLatchRejectsProfileAndContactMutations() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }
        val model = newModel("quiet-fox", repository)

        model.onEvent(MemberProfileEvent.ProfileSaved(profile("quiet-fox", "Unsaved Change")))
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(repository.removedContactIDs.isEmpty())
        assertTrue(model.state.value.hostingLoaded)
        assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
    }

    @Test
    fun nonAuthenticationRelationshipFailureLeavesProfileUsable() {
        val repository = FakeMemberProfileRepository().apply {
            relationshipResult = Result.failure(IOException("Temporary relationship failure"))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertEquals("Quiet Fox", state.profile?.displayName)
        assertTrue(state.relationshipResolved)
        assertNull(state.relationship)
        assertNull(state.failure)
    }

    @Test
    fun profileWithoutAnExistingRelationshipDoesNotAttemptContactRemoval() {
        val repository = FakeMemberProfileRepository().apply {
            relationshipResult = Result.success(ContactRelationship(id = null, confirmed = false))
        }
        val model = newModel("quiet-fox", repository)

        assertTrue(model.state.value.relationshipResolved)
        assertEquals(ContactRelationship(null, false), model.state.value.relationship)
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertTrue(repository.removedContactIDs.isEmpty())
        assertFalse(model.state.value.isRemovingContact)
        assertNull(model.state.value.removalFailure)
    }

    @Test
    fun confirmingContactRemovalUpdatesTheRelationshipWithoutReloadingTheProfile() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)

        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals(listOf("relationship-fox"), repository.removedContactIDs)
        assertEquals(ContactRelationship(null, false), model.state.value.relationship)
        assertTrue(model.state.value.contactRemovalSucceeded)
        assertFalse(model.state.value.isRemovingContact)
    }

    private fun newModel(
        username: String,
        repository: FakeMemberProfileRepository,
        scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
    ) = MemberProfileViewModel(
        username = username,
        ownUsername = "member-self",
        repository = repository,
        scope = scope,
    )

    private class Owner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class UnrelatedViewModel : ViewModel()

    private class FakeMemberProfileRepository : MemberProfileRepository {
        val removedContactIDs = mutableListOf<String>()
        var profileResult: Result<MemberProfile> = Result.success(profile("quiet-fox", "Quiet Fox"))
        var profileHandler: (suspend (String) -> Result<MemberProfile>)? = null
        var profileCalls = 0
        var currentCookie: String? = "connect.sid=fictional-session"
        var currentApi: MobileApiClient? = MobileApiClient("http://127.0.0.1:1")
        var hostingCalls = 0
        var contactsCalls = 0
        var hostingResult: Result<AccommodationOffer?> = Result.success(AccommodationOffer("offer-fox", "yes", "A home", null, 2))
        var relationshipResult: Result<ContactRelationship> = Result.success(ContactRelationship("relationship-fox", true))
        var relationshipCalls = 0
        var referenceCalls = 0
        var contactsResult: Result<List<ProfileContact>> = Result.success(
            listOf(ProfileContact("contact-owl", org.trustroots.android.api.MessageMember("owl-id", "steady-owl", "Steady Owl"))),
        )
        var referencesResult: Result<List<ProfileReference>> = Result.success(
            listOf(ProfileReference("reference-one", org.trustroots.android.api.MessageMember("ref-id", "reference-owl", "Reference Owl"), "A kind visit", "yes", null)),
        )
        var referencesHandler: (suspend (Int) -> Result<List<ProfileReference>>)? = null
        var removalResult: Result<Unit> = Result.success(Unit)
        var removalHandler: (suspend (String) -> Result<Unit>)? = null
        var blockedMembersCalls = 0
        var blockedMembersResult: Result<List<MessageMember>> = Result.success(emptyList())
        var blockedMembersHandler: (suspend (Int) -> Result<List<MessageMember>>)? = null
        val blockChanges = mutableListOf<Pair<String, Boolean>>()
        var setBlockedHandler: (suspend (String, Boolean) -> Result<Unit>)? = null
        var reportResult: Result<Unit> = Result.success(Unit)
        val reports = mutableListOf<Pair<String, String>>()
        var reportHandler: (suspend (String, String) -> Result<Unit>)? = null
        override fun updateApi(api: MobileApiClient): Boolean {
            val changed = currentApi?.backendURL != api.backendURL
            currentApi = api
            return changed
        }
        override fun updateSession(session: MemberSession): Boolean {
            val changed = currentCookie != session.cookieHeader
            currentCookie = session.cookieHeader
            return changed
        }
        override suspend fun profile(username: String): Result<MemberProfile> {
            profileCalls++
            val handler = profileHandler ?: { _: String -> profileResult }
            return handler(username)
        }
        override suspend fun hosting(memberID: String): Result<AccommodationOffer?> {
            hostingCalls++
            return hostingResult
        }
        override suspend fun contacts(memberID: String): Result<List<ProfileContact>> {
            contactsCalls++
            return contactsResult
        }
        override suspend fun references(memberID: String): Result<List<ProfileReference>> {
            referenceCalls++
            return referencesHandler?.invoke(referenceCalls) ?: referencesResult
        }
        override suspend fun relationship(memberID: String): Result<ContactRelationship> {
            relationshipCalls++
            return relationshipResult
        }
        override suspend fun removeContact(contactID: String): Result<Unit> {
            removedContactIDs += contactID
            return removalHandler?.invoke(contactID) ?: removalResult
        }
        override suspend fun blockedMembers(): Result<List<MessageMember>> {
            blockedMembersCalls++
            return blockedMembersHandler?.invoke(blockedMembersCalls) ?: blockedMembersResult
        }
        override suspend fun setMemberBlocked(username: String, blocked: Boolean): Result<Unit> {
            blockChanges += username to blocked
            return setBlockedHandler?.invoke(username, blocked) ?: Result.success(Unit)
        }
        override suspend fun reportMember(username: String, message: String): Result<Unit> {
            reports += username to message
            return reportHandler?.invoke(username, message) ?: reportResult
        }
    }

    private companion object {
        fun reference(id: String, author: String) = ProfileReference(
            id,
            org.trustroots.android.api.MessageMember("member-$author", author, author),
            "A fictional reference",
            "yes",
            null,
        )

        fun profile(username: String, displayName: String) = MemberProfile(
            id = "member-$username", username = username, displayName = displayName,
            tagline = null, description = null, location = null, languages = emptyList(),
        )
    }
}
