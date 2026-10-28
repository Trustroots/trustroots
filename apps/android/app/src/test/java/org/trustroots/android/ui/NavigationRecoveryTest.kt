package org.trustroots.android.ui

import androidx.navigation3.runtime.NavKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import org.trustroots.android.ui.search.SearchHomeVisit
import org.trustroots.android.ui.search.SearchMemberProfileVisit
import org.trustroots.android.ui.search.SearchMode
import org.trustroots.android.ui.search.SearchModeVisit
import org.trustroots.android.ui.search.restoreSearchModeIfMissing

class NavigationRecoveryTest {
    @Test fun activeTabKeepsItsVisitIdentityAndRequestedConversation() {
        val visit = MemberTabVisit(Destination.Messages, 4L, "fictional-member")
        assertSame(visit, currentMemberTab(listOf(MemberTabVisit(Destination.Circles, 0L), visit)))
    }

    @Test fun missingOrUnexpectedTabRoutesUseTheRootTab() {
        val root = MemberTabVisit(Destination.Circles, 0L)
        assertEquals(root, currentMemberTab(emptyList()))
        assertEquals(root, currentMemberTab(listOf(MemberShellVisit("quiet-fox"))))
    }

    @Test fun restoredSearchAnchorGetsItsMissingModeAndConsumesOneVisitID() {
        for (mode in SearchMode.entries) {
            val routes = mutableListOf<NavKey>(SearchHomeVisit(3L))
            assertEquals(8L, restoreSearchModeIfMissing(routes, mode, 7L))
            assertEquals(listOf(SearchHomeVisit(3L), SearchModeVisit(mode, 7L)), routes)
            assertEquals(8L, restoreSearchModeIfMissing(routes, mode, 8L))
            assertEquals(2, routes.size)
        }
    }

    @Test fun existingRoutesAreNotReplacedAndDoNotConsumeVisitIDs() {
        val examples = listOf(
            emptyList<NavKey>(),
            listOf(SearchMemberProfileVisit("quiet-fox", 2L)),
            listOf(SearchHomeVisit(1L), SearchModeVisit(SearchMode.Members, 2L)),
        )
        for (example in examples) {
            val routes = example.toMutableList()
            assertEquals(9L, restoreSearchModeIfMissing(routes, SearchMode.Map, 9L))
            assertEquals(example, routes)
        }
    }
}
