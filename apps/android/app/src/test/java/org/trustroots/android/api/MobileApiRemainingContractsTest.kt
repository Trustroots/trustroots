package org.trustroots.android.api

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class MobileApiRemainingContractsTest {
    @Test
    fun rejectsApiOriginsWithFragments() {
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("https://api.example.test/#private-fragment")
        }
    }

    @Test
    fun rejectsBlankProfileAndMessageWritesBeforeNetworkIo() {
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("calm-lynx", "Calm Lynx"),
        )
        val api = MobileApiClient("http://127.0.0.1:1")

        val profileResult = runBlocking {
            api.updateProfile(session, ProfileUpdate("  ", "", "", "", "", emptyList()))
        }
        val messageResult = runBlocking { api.sendMessage(session, "steady-heron", "  ") }

        assertEquals(IllegalArgumentException::class.java, profileResult.exceptionOrNull()?.javaClass)
        assertEquals(IllegalArgumentException::class.java, messageResult.exceptionOrNull()?.javaClass)
    }

    @Test
    fun unavailableOffersKeepGuestLimitAbsentAndUseTheirFallbackDescription() {
        val hostOffer = parseHostOffer(
            JSONObject(
                """{"_id":"offer-no","status":"no","description":"  ","noOfferDescription":"A fictional unavailable date.","maxGuests":null,"user":{"username":"calm-lynx"}}""",
            ),
        )
        val accommodationOffer = parseAccommodationOffer(
            JSONObject(
                """{"id":"offer-no","status":"no","maxGuests":null}""",
            ),
        )

        assertEquals("no", hostOffer.status)
        assertEquals("A fictional unavailable date.", hostOffer.description)
        assertNull(hostOffer.maxGuests)
        assertEquals("no", accommodationOffer.status)
        assertNull(accommodationOffer.maxGuests)
    }
}
