package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class MobileApiClientTest {
    @Test
    fun classifiesAuthenticationFailures() {
        assertTrue(MobileApiException(401, "Signed out").isAuthenticationFailure)
        assertFalse(MobileApiException(403, "Forbidden").isAuthenticationFailure)
        assertFalse(MobileApiException(500, "Unavailable").isAuthenticationFailure)
    }

    @Test
    fun parsesExistingSignInMemberPayload() {
        val member = mobileMemberFrom(
            JSONObject(
                """{"username":"river-otter","displayName":"River Otter","public":true}""",
            ),
        )

        assertEquals("river-otter", member.username)
        assertEquals("River Otter", member.displayName)
    }

    @Test
    fun selectsMemberSessionFromMultipleResponseCookies() {
        val sessionCookie = sessionCookieFrom(
            mapOf(
                "set-cookie" to listOf(
                    "_passenger_route=route-value; Path=/; Secure",
                    "connect.sid=session-value; Path=/; HttpOnly",
                ),
            ),
        )

        assertEquals("connect.sid=session-value", sessionCookie)
    }

    @Test
    fun usesUsernameWhenDisplayNameIsAbsent() {
        val member = mobileMemberFrom(JSONObject("""{"username":"quiet-fox"}"""))

        assertEquals("quiet-fox", member.username)
        assertEquals("quiet-fox", member.displayName)
    }

    @Test
    fun usesUsernameWhenDisplayNameIsBlank() {
        val member = mobileMemberFrom(
            JSONObject("""{"username":"steady-heron","displayName":""}"""),
        )

        assertEquals("steady-heron", member.displayName)
    }

    @Test
    fun acceptsHttpsAndLocalEmulatorApiOrigins() {
        assertEquals(
            "https://www.trustroots.org",
            secureApiBaseURL("https://www.trustroots.org/"),
        )
        assertEquals(
            "http://10.0.2.2:13001",
            secureApiBaseURL("http://10.0.2.2:13001"),
        )
    }

    @Test
    fun rejectsRemoteCleartextAndNonOriginApiAddresses() {
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("http://api.example.test")
        }
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("https://member:secret@api.example.test")
        }
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("https://api.example.test/mobile?token=secret")
        }
    }
}
