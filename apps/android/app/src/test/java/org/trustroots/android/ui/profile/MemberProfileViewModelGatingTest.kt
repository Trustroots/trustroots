package org.trustroots.android.ui.profile

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberProfileViewModelGatingTest {
    @Test
    fun blockedListFallsBackToUsernameWhenMemberHasNoIDButCandidateDoes() {
        val repository = FakeRepository()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = MemberProfileViewModel(
                username = "quiet-fox",
                ownUsername = "member-self",
                repository = repository,
                scope = scope,
            )

            assertTrue(model.state.value.isBlocked == true)
            assertEquals(1, repository.blockedMembersCalls)
        } finally {
            scope.cancel()
        }
    }

    private class FakeRepository : MemberProfileRepository {
        var blockedMembersCalls = 0

        override suspend fun profile(username: String) = Result.success(
            MemberProfile(
                id = null,
                username = username,
                displayName = "Quiet Fox",
                tagline = null,
                description = null,
                location = null,
                languages = emptyList(),
            ),
        )

        override suspend fun hosting(memberID: String): Result<AccommodationOffer?> = Result.success(null)
        override suspend fun contacts(memberID: String): Result<List<ProfileContact>> = Result.success(emptyList())
        override suspend fun references(memberID: String): Result<List<ProfileReference>> = Result.success(emptyList())
        override suspend fun relationship(memberID: String) = Result.success(ContactRelationship(null, false))
        override suspend fun removeContact(contactID: String): Result<Unit> = Result.success(Unit)
        override suspend fun blockedMembers(): Result<List<MessageMember>> {
            blockedMembersCalls++
            return Result.success(listOf(MessageMember("different-member-id", "QUIET-FOX", "Quiet Fox")))
        }
        override suspend fun setMemberBlocked(username: String, blocked: Boolean): Result<Unit> = Result.success(Unit)
        override suspend fun reportMember(username: String, message: String): Result<Unit> = Result.success(Unit)
    }
}
