package org.trustroots.android.ui.profile

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
internal data class MemberProfileVisit(val username: String, val visitID: Long) : NavKey
