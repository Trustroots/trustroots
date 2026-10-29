package org.trustroots.android.ui.profile

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.rememberEntryViewModel

internal sealed interface ProfileFlowCompletion {
    val deliveryID: Long

    data class ProfileSaved(override val deliveryID: Long, val profile: MemberProfile) : ProfileFlowCompletion
    data class ExperienceCreated(override val deliveryID: Long) : ProfileFlowCompletion
}

internal fun deliverProfileFlowCompletion(
    completion: ProfileFlowCompletion?,
    consume: (Long) -> ProfileFlowCompletion?,
    onEvent: (MemberProfileEvent) -> Unit,
) {
    val deliveryID = completion?.deliveryID ?: return
    when (val pending = consume(deliveryID) ?: return) {
        is ProfileFlowCompletion.ProfileSaved -> onEvent(MemberProfileEvent.ProfileSaved(pending.profile))
        is ProfileFlowCompletion.ExperienceCreated -> onEvent(MemberProfileEvent.RefreshReferences)
    }
}

internal class ProfileFlowEnvironment(
    val backendURL: String,
    val username: String,
    cookieHeader: String,
) {
    private val cookieFingerprint = MessageDigest.getInstance("SHA-256").digest(cookieHeader.toByteArray(Charsets.UTF_8))

    override fun equals(other: Any?): Boolean = other is ProfileFlowEnvironment &&
        backendURL == other.backendURL && username == other.username && cookieFingerprint.contentEquals(other.cookieFingerprint)

    override fun hashCode(): Int = 31 * (31 * backendURL.hashCode() + username.hashCode()) + cookieFingerprint.contentHashCode()
}

internal data class ProfileFlowHandoff(
    val profileSnapshot: MemberProfile? = null,
    val displayName: String? = null,
    val completion: ProfileFlowCompletion? = null,
)

internal class ProfileFlowHandoffViewModel : ViewModel() {
    private val mutableHandoffs = MutableStateFlow<Map<Long, ProfileFlowHandoff>>(emptyMap())
    val handoffs = mutableHandoffs.asStateFlow()
    private val mutableEnvironment = MutableStateFlow<ProfileFlowEnvironment?>(null)
    val runtimeEnvironment = mutableEnvironment.asStateFlow()

    private var nextCompletionID = 0L
    private var environment: ProfileFlowEnvironment? = null
    @Volatile
    private var cleared = false

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        if (cleared) return
        val current = ProfileFlowEnvironment(api.backendURL, session.member.username, session.cookieHeader)
        val previous = environment
        if (previous != null && previous != current) mutableHandoffs.value = emptyMap()
        environment = current
        mutableEnvironment.value = current
    }

    fun retainProfile(visitID: Long, profile: MemberProfile, expectedEnvironment: ProfileFlowEnvironment) {
        if (cleared || environment != expectedEnvironment) return
        update(visitID) { it.copy(profileSnapshot = profile, displayName = profile.displayName) }
    }

    fun retainDisplayName(visitID: Long, displayName: String, expectedEnvironment: ProfileFlowEnvironment) {
        if (cleared || environment != expectedEnvironment) return
        update(visitID) { it.copy(displayName = displayName) }
    }

    fun completeProfileSaved(parentVisitID: Long, profile: MemberProfile, expectedEnvironment: ProfileFlowEnvironment) {
        if (cleared || environment != expectedEnvironment) return
        val completion = ProfileFlowCompletion.ProfileSaved(++nextCompletionID, profile)
        update(parentVisitID) { it.copy(completion = completion) }
    }

    fun completeExperienceCreated(parentVisitID: Long, expectedEnvironment: ProfileFlowEnvironment) {
        if (cleared || environment != expectedEnvironment) return
        val completion = ProfileFlowCompletion.ExperienceCreated(++nextCompletionID)
        update(parentVisitID) { it.copy(completion = completion) }
    }

    fun consumeCompletion(parentVisitID: Long, deliveryID: Long): ProfileFlowCompletion? {
        if (cleared) return null
        val pending = mutableHandoffs.value[parentVisitID]?.completion ?: return null
        if (pending.deliveryID != deliveryID) return null
        update(parentVisitID) { it.copy(completion = null) }
        return pending
    }

    fun removeProfileVisit(visitID: Long) {
        if (cleared) return
        mutableHandoffs.value = mutableHandoffs.value - visitID
    }

    private inline fun update(visitID: Long, transform: (ProfileFlowHandoff) -> ProfileFlowHandoff) {
        if (cleared) return
        val current = mutableHandoffs.value
        mutableHandoffs.value = current + (visitID to transform(current[visitID] ?: ProfileFlowHandoff()))
    }

    override fun onCleared() {
        cleared = true
        environment = null
        mutableEnvironment.value = null
        mutableHandoffs.value = emptyMap()
        super.onCleared()
    }

    class Factory : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(ProfileFlowHandoffViewModel::class.java))
            return ProfileFlowHandoffViewModel() as T
        }
    }
}

@Composable
internal fun rememberProfileFlowHandoffViewModel(
    api: MobileApiClient,
    session: MemberSession,
): ProfileFlowHandoffViewModel {
    val owner: ViewModelStoreOwner = requireNavigationViewModelStoreOwner("Profile route handoffs must use their enclosing decorated Navigation 3 entry owner.")
    val viewModel = rememberEntryViewModel(
        owner = owner,
        modelClass = ProfileFlowHandoffViewModel::class.java,
        factory = ProfileFlowHandoffViewModel.Factory(),
        key = "ProfileFlowHandoffViewModel",
    )
    SideEffect { viewModel.updateEnvironment(api, session) }
    return viewModel
}
