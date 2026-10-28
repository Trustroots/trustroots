package org.trustroots.android.ui.profile

import androidx.lifecycle.ViewModelStore
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
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberProfileBranchContractsTest {
    @Test
    fun clearingNavigationEntryResetsStateAndIgnoresPendingProfileResult() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingProfile = CompletableDeferred<Result<MemberProfile>>()
        val repository = ClearingRepository().apply {
            profileHandler = { withContext(NonCancellable) { pendingProfile.await() } }
        }
        val model = MemberProfileViewModel("quiet-fox", "member-self", repository, scope)
        val store = ViewModelStore().apply { put("MemberProfileViewModel:quiet-fox", model) }

        assertTrue(model.state.value.isLoading)
        store.clear()

        assertEquals(MemberProfileUiState(isLoading = false), model.state.value)
        pendingProfile.complete(Result.success(profile()))
        assertEquals(MemberProfileUiState(isLoading = false), model.state.value)
        assertEquals(1, repository.profileCalls)
        scope.cancel()
    }

    @Test
    fun clearingNavigationEntryCancelsPendingProfileActionsAndRejectsLateResponses() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingReferences = CompletableDeferred<Result<List<ProfileReference>>>()
        val pendingRemoval = CompletableDeferred<Result<Unit>>()
        val pendingBlock = CompletableDeferred<Result<Unit>>()
        val pendingReport = CompletableDeferred<Result<Unit>>()
        val repository = ClearingRepository().apply {
            referencesHandler = { withContext(NonCancellable) { pendingReferences.await() } }
            removalHandler = { withContext(NonCancellable) { pendingRemoval.await() } }
            blockHandler = { withContext(NonCancellable) { pendingBlock.await() } }
            reportHandler = { withContext(NonCancellable) { pendingReport.await() } }
        }
        val model = MemberProfileViewModel("quiet-fox", "member-self", repository, scope)
        val store = ViewModelStore().apply { put("MemberProfileViewModel:quiet-fox", model) }

        model.onEvent(MemberProfileEvent.RefreshReferences)
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)
        model.onEvent(MemberProfileEvent.SetBlocked(true))
        model.onEvent(MemberProfileEvent.ReportDraftChanged("A fictional concern."))
        model.onEvent(MemberProfileEvent.SubmitReport)

        assertTrue(model.state.value.isRemovingContact)
        assertTrue(model.state.value.isUpdatingBlock)
        assertTrue(model.state.value.isSubmittingReport)
        store.clear()

        assertEquals(MemberProfileUiState(isLoading = false), model.state.value)
        pendingReferences.complete(Result.success(emptyList()))
        pendingRemoval.complete(Result.success(Unit))
        pendingBlock.complete(Result.success(Unit))
        pendingReport.complete(Result.success(Unit))

        assertEquals(MemberProfileUiState(isLoading = false), model.state.value)
        assertEquals(2, repository.referenceCalls)
        assertEquals(1, repository.removalCalls)
        assertEquals(1, repository.blockCalls)
        assertEquals(1, repository.reportCalls)
        assertNull(model.state.value.pendingSessionInvalidation)
        assertFalse(model.state.value.isLoading)
        scope.cancel()
    }

    private class ClearingRepository : MemberProfileRepository {
        var profileHandler: (suspend () -> Result<MemberProfile>)? = null
        var profileCalls = 0
        var referencesHandler: (suspend () -> Result<List<ProfileReference>>)? = null
        var referenceCalls = 0
        var removalHandler: (suspend () -> Result<Unit>)? = null
        var removalCalls = 0
        var blockHandler: (suspend () -> Result<Unit>)? = null
        var blockCalls = 0
        var reportHandler: (suspend () -> Result<Unit>)? = null
        var reportCalls = 0

        override suspend fun profile(username: String): Result<MemberProfile> {
            profileCalls++
            return profileHandler?.invoke() ?: Result.success(profile())
        }

        override suspend fun hosting(memberID: String): Result<AccommodationOffer?> = Result.success(null)
        override suspend fun contacts(memberID: String): Result<List<ProfileContact>> = Result.success(emptyList())

        override suspend fun references(memberID: String): Result<List<ProfileReference>> {
            referenceCalls++
            return referencesHandler?.invoke() ?: Result.success(emptyList())
        }

        override suspend fun relationship(memberID: String): Result<ContactRelationship> =
            Result.success(ContactRelationship("fictional-relationship", true))

        override suspend fun removeContact(contactID: String): Result<Unit> {
            removalCalls++
            return removalHandler?.invoke() ?: Result.success(Unit)
        }

        override suspend fun blockedMembers(): Result<List<MessageMember>> = Result.success(emptyList())

        override suspend fun setMemberBlocked(username: String, blocked: Boolean): Result<Unit> {
            blockCalls++
            return blockHandler?.invoke() ?: Result.success(Unit)
        }

        override suspend fun reportMember(username: String, message: String): Result<Unit> {
            reportCalls++
            return reportHandler?.invoke() ?: Result.success(Unit)
        }
    }

    private companion object {
        fun profile() = MemberProfile(
            id = "member-quiet-fox",
            username = "quiet-fox",
            displayName = "Quiet Fox",
            tagline = null,
            description = null,
            location = null,
            languages = emptyList(),
        )
    }
}
