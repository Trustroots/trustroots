package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiPayloadBranchTest {
    @Test
    fun nullAndWrongTypeGroupsAreEmptyAndSparseMembersUseParsedOptionalFields() {
        val groups = parseCircleMemberGroups(
            JSONObject(
                """{"contacts":null,"recommenders":"unexpected","active":[false,{"username":""},{"username":"  "},{"username":" Fern-Owl ","id":" member-id "}]}""",
            ),
        )

        assertEquals(emptyList<MessageMember>(), groups.contacts)
        assertEquals(emptyList<MessageMember>(), groups.recommenders)
        assertEquals(
            listOf(MessageMember(id = "member-id", username = "Fern-Owl", displayName = "")),
            groups.active,
        )
    }
}
