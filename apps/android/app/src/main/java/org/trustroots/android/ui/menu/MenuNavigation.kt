package org.trustroots.android.ui.menu

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable as KotlinSerializable

/** A Contacts-origin profile visit with only its public username in route state. */
@KotlinSerializable
internal data class MenuMemberProfileVisit(val username: String, val visitID: Long) : NavKey

/** Direct Edit Profile destination with only the member identity and visit. */
@KotlinSerializable
internal data class MenuEditProfileVisit(val username: String, val visitID: Long) : NavKey
