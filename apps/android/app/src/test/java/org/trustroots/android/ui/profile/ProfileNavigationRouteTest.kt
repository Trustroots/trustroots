package org.trustroots.android.ui.profile

import org.junit.Assert.assertEquals
import org.junit.Test

class ProfileNavigationRouteTest {
    @Test fun profileConversationKeyContainsOnlyMemberIDAndVisitID() {
        val route = ProfileConversationVisit(memberID = "member-fox", visitID = 12L)
        val descriptor = ProfileConversationVisit.serializer().descriptor

        assertEquals(2, descriptor.elementsCount)
        assertEquals(setOf("memberID", "visitID"), (0 until descriptor.elementsCount).map(descriptor::getElementName).toSet())
        assertEquals("member-fox", route.memberID)
        assertEquals(12L, route.visitID)
    }

    @Test fun contactRequestBrowserKeyContainsNoURLTitleOrSessionCookie() {
        val route = ProfileBrowserVisit(
            destination = ProfileBrowserDestination.ContactRequest,
            memberID = "member-fox",
            visitID = 13L,
        )
        val descriptor = ProfileBrowserVisit.serializer().descriptor

        assertEquals(3, descriptor.elementsCount)
        assertEquals(
            setOf("destination", "memberID", "visitID"),
            (0 until descriptor.elementsCount).map(descriptor::getElementName).toSet(),
        )
        assertEquals(ProfileBrowserDestination.ContactRequest, route.destination)
        assertEquals("member-fox", route.memberID)
        assertEquals(13L, route.visitID)
    }
}
