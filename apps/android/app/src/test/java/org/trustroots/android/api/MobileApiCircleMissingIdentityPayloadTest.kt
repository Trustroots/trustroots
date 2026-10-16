package org.trustroots.android.api

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiCircleMissingIdentityPayloadTest {
    @Test fun skipsCircleRowsWithoutAnIdentifierButKeepsCompleteRows() {
        val circles = parseCircles(
            JSONArray(
                """[
                    {"slug":"missing-id","label":"Unidentified Circle"},
                    {"_id":"circle-missing-slug","label":"Incomplete Circle"},
                    {"_id":"circle-missing-label","slug":"incomplete"},
                    {"_id":"circle-fictional","slug":"wayfarers","label":"Wayfarers"}
                ]""",
            ),
        )

        assertEquals(listOf("circle-fictional"), circles.map { it.id })
        assertEquals("Wayfarers", circles.single().label)
    }
}
