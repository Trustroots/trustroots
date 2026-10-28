package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MobileApiCircleRequiredIdentityTest {
    @Test
    fun singleCircleParserRejectsMissingPublicIdentity() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            parseCircle(JSONObject("""{"_id":"fictional-circle-id","label":"Fictional Circle"}"""))
        }

        assertEquals("Circle response is missing its public identity.", error.message)
    }
}
