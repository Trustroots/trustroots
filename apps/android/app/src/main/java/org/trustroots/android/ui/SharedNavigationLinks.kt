package org.trustroots.android.ui

/**
 * Mirror of the shared navigation link registry at
 * `modules/core/shared/navigation-links.json`.
 *
 * The JSON is the single source of truth for the Info and support link
 * labels, URLs and ordering, and for the profile-experiences URL pattern.
 * Keep this object aligned with the JSON; `SharedNavigationLinksTest`
 * fails the build when the two drift apart.
 */
data class SharedNavigationLink(
    val id: String,
    val label: String,
    val url: String,
)

object SharedNavigationLinks {
    const val SITE_URL = "https://www.trustroots.org"

    /** Phone web renders “Info & support”; Android keeps its current wording. */
    const val INFO_AND_SUPPORT_HEADING = "Info and support"

    val INFO_AND_SUPPORT: List<SharedNavigationLink> = listOf(
        SharedNavigationLink("about", "About", "https://www.trustroots.org/about"),
        SharedNavigationLink("blog", "Blog", "https://ideas.trustroots.org/"),
        SharedNavigationLink("contact", "Contact and support", "https://www.trustroots.org/support"),
        SharedNavigationLink("faq", "FAQ", "https://www.trustroots.org/faq"),
        SharedNavigationLink("foundation", "Foundation", "https://www.trustroots.org/foundation"),
        SharedNavigationLink("media", "Media", "https://www.trustroots.org/media"),
        SharedNavigationLink("wiki", "Wiki", "https://wiki.trustroots.org/"),
        SharedNavigationLink("privacy", "Privacy", "https://www.trustroots.org/privacy"),
        SharedNavigationLink("rules", "Rules", "https://www.trustroots.org/rules"),
        SharedNavigationLink("safety", "Safety", "https://www.trustroots.org/safety"),
        SharedNavigationLink("statistics", "Statistics", "https://www.trustroots.org/statistics"),
    )

    const val PROFILE_EXPERIENCES_PATH = "/profile/{username}/experiences/new"

    fun profileExperiencesURL(username: String): String =
        PROFILE_EXPERIENCES_PATH.replace("{username}", username)
}
