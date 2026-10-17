package org.trustroots.android.api

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.LocalTransportFixture

@RunWith(AndroidJUnit4::class)
class MobileApiProtocolResponseJourneyTest {
    @Test fun anUnexpectedProtocolUpgradeIsRejectedWithoutAnErrorBody() = runBlocking {
        LocalTransportFixture { LocalTransportFixture.Response("", status = 101) }.use { local ->
            val session = MemberSession(
                "connect.sid=fictional-protocol-session",
                MobileMember("steady-heron", "Steady Heron"),
            )

            val failure = MobileApiClient(local.baseURL).accountDetails(session).exceptionOrNull()

            assertTrue("An unexpected upgrade must be rejected as an API response", failure is MobileApiException)
            assertEquals(101, (failure as MobileApiException).statusCode)
            assertEquals("The request was not accepted.", failure.message)
            assertEquals(1, local.requests.size)
            assertEquals("/api/users/steady-heron", local.requests.single().path)
            assertEquals(session.cookieHeader, local.requests.single().cookie)
        }
    }

    @Test fun signInTransportFailureDoesNotReturnAnOfflineSession() = runBlocking {
        LocalTransportFixture { null }.use { local ->
            val api = MobileApiClient(local.baseURL, cacheAccount = "fictional-cached-account")

            val failure = api.signIn("steady-heron", "fictional-password").exceptionOrNull()

            assertTrue(failure is IOException)
            assertNull(api.offlineSavedAt.value)
            assertTrue(local.requests.isNotEmpty())
            local.requests.forEach { request ->
                assertEquals("POST", request.method)
                assertEquals("/api/auth/signin", request.path)
                assertNull(request.cookie)
                val body = JSONObject(request.body)
                assertEquals("steady-heron", body.getString("username"))
                assertEquals("fictional-password", body.getString("password"))
            }
        }
    }
}
