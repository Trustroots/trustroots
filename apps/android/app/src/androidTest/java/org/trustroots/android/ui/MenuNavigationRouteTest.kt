package org.trustroots.android.ui

import androidx.test.core.app.ApplicationProvider
import android.content.Context
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MenuNavigationRouteTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @Test fun browserRouteKeysResolveTitlesAndUrlsFromStableIdentifiers() {
        val supportRoute = MenuBrowserVisit(MenuBrowserDestination.SupportLink, 3L, "faq")
        val support = browserRouteFor(supportRoute, "fictional=session", context)
        assertEquals("FAQ", support.title)
        assertEquals("https://www.trustroots.org/faq", support.url)
        assertNull(support.sessionCookie)

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
}
