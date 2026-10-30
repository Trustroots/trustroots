package org.trustroots.android.ui

import android.content.Context
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.serialization.NavBackStackSerializer
import androidx.navigation3.runtime.serialization.NavKeySerializer
import androidx.savedstate.serialization.decodeFromSavedState
import androidx.savedstate.serialization.encodeToSavedState
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.trustroots.android.ui.menu.MenuMemberProfileVisit
import org.trustroots.android.ui.common.SharedNavigationLinks
import org.trustroots.android.ui.menu.supportLinkLabelResource
import org.trustroots.android.ui.menu.browserRouteFor

class MenuNavigationRouteTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @Test fun browserRouteKeysResolveTitlesAndUrlsFromStableIdentifiers() {
        val supportRoute = MenuBrowserVisit(MenuBrowserDestination.SupportLink, 3L, "faq")
        val support = browserRouteFor(supportRoute, "fictional=session", context)
        assertEquals("FAQ", support.title)
        assertEquals("https://www.trustroots.org/faq", support.url)
        assertNull(support.sessionCookie)

        val unknownSupport = browserRouteFor(
            MenuBrowserVisit(MenuBrowserDestination.SupportLink, 5L, "unknown"),
            "fictional=session",
            context,
        )
        assertEquals(context.getString(org.trustroots.android.R.string.screen_info_and_support), unknownSupport.title)
        assertEquals(SharedNavigationLinks.SITE_URL, unknownSupport.url)
        assertNull(unknownSupport.sessionCookie)
        assertEquals(
            org.trustroots.android.R.string.screen_info_and_support,
            supportLinkLabelResource("unknown"),
        )
        assertEquals(
            org.trustroots.android.R.string.screen_menu_link_media,
            supportLinkLabelResource("media"),
        )

        val privateSite = browserRouteFor(
            MenuBrowserVisit(MenuBrowserDestination.Nostroots, 4L),
            "fictional=session",
            context,
        )
        assertEquals("Nostroots", privateSite.title)
        assertEquals("https://nos.trustroots.org/", privateSite.url)
        assertEquals("fictional=session", privateSite.sessionCookie)
    }

    @Test fun browserRouteKeyContainsNoTitleUrlOrCredentialPayload() {
        val descriptor = MenuBrowserVisit.serializer().descriptor
        val fields = (0 until descriptor.elementsCount).map(descriptor::getElementName)
        assertEquals(listOf("destination", "visitID", "supportLinkID"), fields)
    }

    @Test fun menuBackStackRestoresUsingStableLegacyJavaClassNames() {
        val serializer = NavBackStackSerializer<NavKey>(NavKeySerializer())
        val original = NavBackStack<NavKey>(
            MenuPageVisit(MenuPage.Profile, 41L),
            MenuPageVisit(MenuPage.EditProfile, 43L),
            MenuBrowserVisit(MenuBrowserDestination.SupportLink, 44L, "faq"),
            MenuBrowserVisit(MenuBrowserDestination.SupportLink, 45L),
        )

        val savedState = encodeToSavedState(serializer, original)
        val restored = decodeFromSavedState(serializer, savedState)

        assertEquals("org.trustroots.android.ui.MenuPageVisit", restored[0].javaClass.name)
        assertEquals(MenuPageVisit(MenuPage.Profile, 41L), restored[0])
        assertEquals("org.trustroots.android.ui.MenuPageVisit", restored[1].javaClass.name)
        assertEquals(MenuPageVisit(MenuPage.EditProfile, 43L), restored[1])
        assertEquals("org.trustroots.android.ui.MenuBrowserVisit", restored[2].javaClass.name)
        assertEquals(MenuBrowserVisit(MenuBrowserDestination.SupportLink, 44L, "faq"), restored[2])
        assertEquals("org.trustroots.android.ui.MenuBrowserVisit", restored[3].javaClass.name)
        assertEquals(MenuBrowserVisit(MenuBrowserDestination.SupportLink, 45L), restored[3])
        assertNull((restored[3] as MenuBrowserVisit).supportLinkID)
    }

    @Test fun contactsProfileRouteKeyContainsOnlyUsernameAndVisitIdentity() {
        val descriptor = MenuMemberProfileVisit.serializer().descriptor
        val fields = (0 until descriptor.elementsCount).map(descriptor::getElementName)

        assertEquals(listOf("username", "visitID"), fields)
    }
}
