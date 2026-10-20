package org.trustroots.android.ui

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable as KotlinSerializable

/** Safe route identity for a page in one Profile/menu tab visit. */
@KotlinSerializable
internal data class MenuPageVisit(val page: MenuPage, val visitID: Long) : NavKey

/** A Contacts-origin profile visit with only its public username in route state. */
@KotlinSerializable
internal data class MenuMemberProfileVisit(val username: String, val visitID: Long) : NavKey

/** Browser keys contain a stable link identifier, never a translated title or session cookie. */
@KotlinSerializable
internal data class MenuBrowserVisit(
    val destination: MenuBrowserDestination,
    val visitID: Long,
    val supportLinkID: String? = null,
) : NavKey

@KotlinSerializable
internal enum class MenuPage {
    Menu,
    Profile,
    EditProfile,
    Contacts,
    Host,
    Account,
}

@KotlinSerializable
internal enum class MenuBrowserDestination {
    Nostroots,
    ResetPassword,
    SupportLink,
}
