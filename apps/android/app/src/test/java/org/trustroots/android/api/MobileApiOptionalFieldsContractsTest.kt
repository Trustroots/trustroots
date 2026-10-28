package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MobileApiOptionalFieldsContractsTest {
    @Test fun guestLimitsPreserveAbsentNullZeroAndNumericStringResponses() {
        listOf(
            "" to null,
            ",\"maxGuests\":null" to null,
            ",\"maxGuests\":0" to 0,
            ",\"maxGuests\":\"3\"" to 3,
            ",\"maxGuests\":\"unknown\"" to 0,
        ).forEach { (field, expected) ->
            val response = JSONObject("""{"_id":"fictional-offer","user":{"username":"steady-heron"}$field}""")
            assertEquals(expected, parseHostOffer(response).maxGuests)
            assertEquals(expected, parseAccommodationOffer(response).maxGuests)
        }
    }

    @Test fun blankPrimaryIdentityUsesThePublicAliasAcrossResponseTypes() {
        val response = JSONObject(
            """{"_id":"  ","id":" public-alias ","username":"steady-heron","slug":"quiet-circle","label":"Quiet Circle"}""",
        )
        assertEquals("public-alias", parseMember(response).id)
        assertEquals("public-alias", parseAccommodationOffer(response).id)
        assertEquals("public-alias", parseCircle(response).id)
    }

    @Test fun optionalDatesRejectWhitespaceAndAcceptTimezoneOffsetsConsistently() {
        val profile = JSONObject("""{"username":"steady-heron","seen":"2026-09-24T16:30:00+02:00"}""")
        val message = JSONObject("""{"_id":"fictional-message","content":"A fictional greeting","userFrom":{"username":"steady-heron"},"created":"2026-09-24T14:30:00Z"}""")
        assertEquals(parseMessage(message).createdAt, parseMember(profile).lastActiveAtMillis)
        profile.put("seen", "  ")
        message.put("created", JSONObject.NULL)
        assertNull(parseMember(profile).lastActiveAtMillis)
        assertNull(parseMessage(message).createdAt)
    }
}
