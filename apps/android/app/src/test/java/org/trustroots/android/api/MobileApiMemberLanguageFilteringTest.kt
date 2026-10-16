package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiMemberLanguageFilteringTest {
    @Test
    fun ignoresBlankLanguageEntriesWhileKeepingReportedLanguages() {
        val member = parseMember(
            JSONObject(
                """{"username":"quiet-fox","languages":["eng","  ","","fra"]}""",
            ),
        )

        assertEquals("quiet-fox", member.username)
        assertEquals(listOf("eng", "fra"), member.languages)
    }
}
