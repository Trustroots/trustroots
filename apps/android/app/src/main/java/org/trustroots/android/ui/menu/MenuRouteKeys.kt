package org.trustroots.android.ui

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable as KotlinSerializable

/**
 * Persisted route types keep their original package names because Navigation 3
 * stores each NavKey's Java class name in Android saved state.
 */
@KotlinSerializable
internal data class MenuPageVisit(val page: MenuPage, val visitID: Long) : NavKey

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
    /** Retained only to restore saved stacks created before Edit Profile became a child route. */
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
