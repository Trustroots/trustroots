package org.trustroots.android.ui.profile

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
internal data class MemberProfileVisit(val username: String, val visitID: Long) : NavKey

@Serializable
internal data class MemberProfileEditVisit(
    val username: String,
    val parentVisitID: Long,
    val visitID: Long,
) : NavKey

@Serializable
internal data class MemberProfileExperienceVisit(
    val username: String,
    val memberID: String,
    val parentVisitID: Long,
    val visitID: Long,
) : NavKey

@Serializable
internal data class ProfileConversationVisit(val memberID: String, val visitID: Long) : NavKey

@Serializable
internal enum class ProfileBrowserDestination {
    ContactRequest,
}

@Serializable
internal data class ProfileBrowserVisit(
    val destination: ProfileBrowserDestination,
    val memberID: String,
    val visitID: Long,
) : NavKey
