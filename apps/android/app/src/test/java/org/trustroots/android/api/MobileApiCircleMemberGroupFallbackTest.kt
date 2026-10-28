package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiCircleMemberGroupFallbackTest {
    @Test
    fun missingGroupsAndMalformedOrAnonymousMembersProduceEmptySafeGroups() {
        val missing = parseCircleMemberGroups(JSONObject("{}"))
        val mixed = parseCircleMemberGroups(
            JSONObject(
                """{"contacts":[null,1,{"displayName":"Anonymous"},{"username":"  "},{"username":"quiet-fox","displayName":"Quiet Fox"}],"active":[]}""",
            ),
        )

        assertEquals(CircleMemberGroups(emptyList(), emptyList(), emptyList()), missing)
        assertEquals(listOf("quiet-fox"), mixed.contacts.map { it.username })
        assertEquals(emptyList<MessageMember>(), mixed.recommenders)
        assertEquals(emptyList<MessageMember>(), mixed.active)
    }
}
