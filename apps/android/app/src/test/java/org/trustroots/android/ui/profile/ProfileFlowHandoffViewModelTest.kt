package org.trustroots.android.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class ProfileFlowHandoffViewModelTest {
    @Test
    fun completionsAreOneShotAndBoundToTheirExactParentVisit() {
        val model = ProfileFlowHandoffViewModel()
        val api = MobileApiClient("https://api.example.invalid")
        val session = MemberSession("connect.sid=fictional-cookie", MobileMember("member-self", "Member Self"))
        val environment = ProfileFlowEnvironment(api.backendURL, session.member.username, session.cookieHeader)
        model.updateEnvironment(api, session)

        val savedProfile = profile("member-one", "Quiet Fox Updated")
        model.retainProfile(10L, profile("member-one", "Quiet Fox"), environment)
        model.completeProfileSaved(10L, savedProfile, environment)
        model.completeExperienceCreated(11L, environment)

        val saved = requireNotNull(model.handoffs.value[10L]?.completion)
        val experience = requireNotNull(model.handoffs.value[11L]?.completion)
        assertTrue(saved is ProfileFlowCompletion.ProfileSaved)
        assertTrue(experience is ProfileFlowCompletion.ExperienceCreated)
        assertNull(model.consumeCompletion(11L, saved.deliveryID))
        assertTrue(model.handoffs.value.containsKey(10L))

        assertEquals(saved, model.consumeCompletion(10L, saved.deliveryID))
        assertNull(model.consumeCompletion(10L, saved.deliveryID))
        assertEquals(experience, model.consumeCompletion(11L, experience.deliveryID))
        assertNull(model.consumeCompletion(11L, experience.deliveryID))
    }

    @Test
    fun profileSnapshotAndDisplayNameStayWithVisitAndClearWhenRuntimeEnvironmentChanges() {
        val model = ProfileFlowHandoffViewModel()
        val api = MobileApiClient("https://api.example.invalid")
        val session = MemberSession("connect.sid=fictional-cookie", MobileMember("member-self", "Member Self"))
        val environment = ProfileFlowEnvironment(api.backendURL, session.member.username, session.cookieHeader)
        val snapshot = profile("member-one", "Quiet Fox")
        model.updateEnvironment(api, session)
        model.retainProfile(10L, snapshot, environment)
        model.retainDisplayName(11L, "Steady Owl", environment)
        model.completeProfileSaved(10L, profile("member-one", "Quiet Fox Updated"), environment)
        val pendingCompletion = model.handoffs.value[10L]?.completion
        model.updateEnvironment(api, session)

        assertEquals(snapshot, model.handoffs.value[10L]?.profileSnapshot)
        assertEquals("Quiet Fox", model.handoffs.value[10L]?.displayName)
        assertEquals(pendingCompletion, model.handoffs.value[10L]?.completion)
        assertEquals("Steady Owl", model.handoffs.value[11L]?.displayName)
        assertFalseStateContainsCookie(model)

        model.updateEnvironment(
            MobileApiClient("https://api.example.invalid"),
            MemberSession("connect.sid=rotated-fictional-cookie", MobileMember("member-self", "Member Self")),
        )

        assertTrue(model.handoffs.value.isEmpty())

        val newEnvironmentSession = MemberSession(
            "connect.sid=third-fictional-cookie",
            MobileMember("other-member", "Other Member"),
        )
        val otherBackend = MobileApiClient("https://other-api.example.invalid")
        val otherEnvironment = ProfileFlowEnvironment(
            otherBackend.backendURL,
            newEnvironmentSession.member.username,
            newEnvironmentSession.cookieHeader,
        )
        model.updateEnvironment(otherBackend, newEnvironmentSession)
        model.retainProfile(12L, snapshot, otherEnvironment)
        assertTrue(model.handoffs.value.containsKey(12L))
        model.updateEnvironment(
            MobileApiClient("https://third-api.example.invalid"),
            MemberSession("connect.sid=fourth-fictional-cookie", MobileMember("third-member", "Third Member")),
        )
        assertTrue("Account and backend replacement clear previous handoffs", model.handoffs.value.isEmpty())
    }

    @Test
    fun removingProfileVisitClearsOnlyItsRuntimeHandoff() {
        val model = ProfileFlowHandoffViewModel()
        val api = MobileApiClient("https://api.example.invalid")
        val session = MemberSession("connect.sid=fictional-cookie", MobileMember("member-self", "Member Self"))
        val environment = ProfileFlowEnvironment(api.backendURL, session.member.username, session.cookieHeader)
        model.updateEnvironment(api, session)
        model.retainProfile(10L, profile("member-one", "Quiet Fox"), environment)
        model.retainProfile(11L, profile("member-two", "Steady Owl"), environment)

        model.removeProfileVisit(10L)

        assertNull(model.handoffs.value[10L])
        assertEquals("Steady Owl", model.handoffs.value[11L]?.displayName)
    }

    @Test
    fun staleCompositionCannotRestoreHandoffsAfterEnvironmentReplacement() {
        val model = ProfileFlowHandoffViewModel()
        val api = MobileApiClient("https://api.example.invalid")
        val firstSession = MemberSession("connect.sid=first-fictional-cookie", MobileMember("member-self", "Member Self"))
        val oldEnvironment = ProfileFlowEnvironment(api.backendURL, firstSession.member.username, firstSession.cookieHeader)
        model.updateEnvironment(api, firstSession)
        model.updateEnvironment(
            api,
            MemberSession("connect.sid=second-fictional-cookie", MobileMember("member-self", "Member Self")),
        )

        model.retainProfile(10L, profile("member-one", "Stale Profile"), oldEnvironment)

        assertTrue(model.handoffs.value.isEmpty())
    }

    @Test
    fun staleEnvironmentCannotRetainNamesOrPublishEitherCompletionType() {
        val model = ProfileFlowHandoffViewModel()
        val api = MobileApiClient("https://api.example.invalid")
        val firstSession = MemberSession("connect.sid=first-fictional-cookie", MobileMember("member-self", "Member Self"))
        val staleEnvironment = ProfileFlowEnvironment(api.backendURL, firstSession.member.username, firstSession.cookieHeader)
        model.updateEnvironment(api, firstSession)
        model.updateEnvironment(
            api,
            MemberSession("connect.sid=second-fictional-cookie", MobileMember("member-self", "Member Self")),
        )

        model.retainDisplayName(10L, "Stale Name", staleEnvironment)
        model.completeProfileSaved(10L, profile("member-one", "Stale Profile"), staleEnvironment)
        model.completeExperienceCreated(10L, staleEnvironment)

        assertTrue(model.handoffs.value.isEmpty())
    }

    @Test
    fun profileFlowEnvironmentEqualityUsesBackendUsernameAndCookieFingerprint() {
        val first = ProfileFlowEnvironment("https://api.example.invalid", "member-self", "fictional-cookie")
        val equivalent = ProfileFlowEnvironment("https://api.example.invalid", "member-self", "fictional-cookie")

        assertEquals(first, equivalent)
        assertEquals(first.hashCode(), equivalent.hashCode())
        assertFalse(first == ProfileFlowEnvironment("https://other.example.invalid", "member-self", "fictional-cookie"))
        assertFalse(first == ProfileFlowEnvironment("https://api.example.invalid", "other-member", "fictional-cookie"))
        assertFalse(first == ProfileFlowEnvironment("https://api.example.invalid", "member-self", "other-cookie"))
        assertFalse(first.equals("not an environment"))
    }

    @Test
    fun profileHandoffFactoryRejectsUnrelatedViewModelTypes() {
        val failure = runCatching {
            ProfileFlowHandoffViewModel.Factory().create(OtherViewModel::class.java)
        }.exceptionOrNull()

        assertTrue(failure is IllegalArgumentException)
    }


    @Test
    fun separateDecoratedEntryOwnersCannotReadOrConsumeEachOthersHandoffs() {
        val firstStore = ViewModelStore()
        val secondStore = ViewModelStore()
        val first = ViewModelProvider(Owner(firstStore), ProfileFlowHandoffViewModel.Factory())[
            "ProfileFlowHandoffViewModel",
            ProfileFlowHandoffViewModel::class.java,
        ]
        val second = ViewModelProvider(Owner(secondStore), ProfileFlowHandoffViewModel.Factory())[
            "ProfileFlowHandoffViewModel",
            ProfileFlowHandoffViewModel::class.java,
        ]
        val api = MobileApiClient("https://api.example.invalid")
        val session = MemberSession("connect.sid=fictional-cookie", MobileMember("member-self", "Member Self"))
        val environment = ProfileFlowEnvironment(api.backendURL, session.member.username, session.cookieHeader)
        first.updateEnvironment(api, session)
        second.updateEnvironment(api, session)
        first.completeExperienceCreated(0L, environment)

        assertTrue(first !== second)
        assertTrue(first.handoffs.value.containsKey(0L))
        assertTrue(second.handoffs.value.isEmpty())
        firstStore.clear()
        secondStore.clear()
    }

    @Test
    fun clearingEntryStoreDiscardsHandoffsAndRejectsLateCallbacks() {
        val store = ViewModelStore()
        val model = ViewModelProvider(Owner(store), ProfileFlowHandoffViewModel.Factory())[
            "ProfileFlowHandoffViewModel",
            ProfileFlowHandoffViewModel::class.java,
        ]
        val api = MobileApiClient("https://api.example.invalid")
        val session = MemberSession("connect.sid=fictional-cookie", MobileMember("member-self", "Member Self"))
        val environment = ProfileFlowEnvironment(api.backendURL, session.member.username, session.cookieHeader)
        model.updateEnvironment(api, session)
        model.retainProfile(10L, profile("member-one", "Quiet Fox"), environment)
        model.completeExperienceCreated(10L, environment)
        val completion = requireNotNull(model.handoffs.value[10L]?.completion)

        store.clear()

        assertTrue(model.handoffs.value.isEmpty())
        assertNull(model.runtimeEnvironment.value)
        assertNull(model.consumeCompletion(10L, completion.deliveryID))

        // Simulate callbacks retaining the cleared ViewModel after the enclosing route is removed.
        model.completeExperienceCreated(11L, environment)
        model.completeProfileSaved(11L, profile("member-two", "Steady Owl"), environment)
        model.retainProfile(11L, profile("member-two", "Steady Owl"), environment)
        model.retainDisplayName(12L, "Calm Badger", environment)
        model.removeProfileVisit(10L)
        model.updateEnvironment(
            MobileApiClient("https://replacement.example.invalid"),
            MemberSession("connect.sid=replacement-cookie", MobileMember("replacement-member", "Replacement")),
        )

        assertTrue(model.handoffs.value.isEmpty())
        assertNull(model.runtimeEnvironment.value)
        assertNull(model.consumeCompletion(11L, 1L))
    }

    private fun assertFalseStateContainsCookie(model: ProfileFlowHandoffViewModel) {
        assertFalse(model.handoffs.value.toString().contains("fictional-cookie"))
    }

    private class Owner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class OtherViewModel : ViewModel()

    private fun profile(id: String, displayName: String) = MemberProfile(
        id = id,
        username = "quiet-fox",
        displayName = displayName,
        tagline = null,
        description = null,
        location = null,
        languages = emptyList(),
    )
}
