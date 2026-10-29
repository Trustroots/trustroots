package org.trustroots.android.api

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONException

class MobileApiMessageMemberFailureTest {
    @Test
    fun malformedMiniMemberResponseIsReturnedAsAParsingFailure() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 200, body = "not-json"))
            server.start()
            val session = MemberSession(
                "connect.sid=fictional-session",
                MobileMember("quiet-fox", "Quiet Fox"),
            )

            val result = MobileApiClient(server.url("/").toString()).messageMember(session, "member-one")
            val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))

            assertTrue(result.exceptionOrNull() is JSONException)
            assertEquals("GET", request.method)
            assertEquals("/api/users/mini/member-one", request.url.encodedPath)
            assertEquals("connect.sid=fictional-session", request.headers["Cookie"])
        }
    }
}
