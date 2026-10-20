package org.trustroots.android.notifications

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

class MessageEndpointRegistrationTest {
    @Test fun leavesAnUnstoredSessionAlone() = runBlocking {
        val statuses = mutableListOf<String>()
        var registerCalls = 0

        register(
            loadSession = { null },
            registerEndpoint = { _, _, _, _ -> registerCalls++; true },
            setStatus = statuses::add,
        )

        assertEquals(emptyList<String>(), statuses)
        assertEquals(0, registerCalls)
    }

    @Test fun ignoresSessionsFromAnotherAccountAndReportsRegistrationFailure() = runBlocking {
        val statuses = mutableListOf<String>()
        var savedEndpoint: String? = null
        var registeredSession: MemberSession? = null

        register(
            loadSession = { session("calm-lynx") },
            registerEndpoint = { current, _, _, _ -> registeredSession = current; false },
            saveEndpoint = { savedEndpoint = it; null },
            setStatus = statuses::add,
        )
        assertNull(registeredSession)

        register(
            loadSession = { session("quiet-fox") },
            registerEndpoint = { current, _, _, _ -> registeredSession = current; false },
            saveEndpoint = { savedEndpoint = it; null },
            setStatus = statuses::add,
        )

        assertEquals(session("quiet-fox"), registeredSession)
        assertNull(savedEndpoint)
        assertEquals(
            listOf("Could not register this distributor endpoint with Trustroots."),
            statuses,
        )
    }

    @Test fun savesSuccessfulEndpointAndUnregistersOnlyAReplacedEndpoint() = runBlocking {
        val statuses = mutableListOf<String>()
        val unregistered = mutableListOf<String>()
        val saved = mutableListOf<String>()
        var registeredSession: MemberSession? = null
        val registerEndpoint: suspend (MemberSession, String, String, String) -> Boolean =
            { current, url, publicKey, authKey ->
                registeredSession = current
                assertEquals("https://push.invalid/topic", url)
                assertEquals("public", publicKey)
                assertEquals("auth", authKey)
                true
            }

        register(
            registerEndpoint = registerEndpoint,
            saveEndpoint = { saved += it; null },
            unregisterEndpoint = { _, url -> unregistered += url },
            setStatus = statuses::add,
        )
        register(
            registerEndpoint = registerEndpoint,
            saveEndpoint = { saved += it; "https://push.invalid/old-topic" },
            unregisterEndpoint = { _, url -> unregistered += url },
            setStatus = statuses::add,
        )
        register(
            registerEndpoint = registerEndpoint,
            saveEndpoint = { saved += it; "https://push.invalid/topic" },
            unregisterEndpoint = { _, url -> unregistered += url },
            setStatus = statuses::add,
        )

        assertEquals(session("quiet-fox"), registeredSession)
        assertEquals(
            listOf("https://push.invalid/topic", "https://push.invalid/topic", "https://push.invalid/topic"),
            saved,
        )
        assertEquals(listOf("https://push.invalid/old-topic"), unregistered)
        assertEquals(
            listOf("Message alerts are ready.", "Message alerts are ready.", "Message alerts are ready."),
            statuses,
        )
    }

    private suspend fun register(
        account: String = "quiet-fox",
        endpointUrl: String = "https://push.invalid/topic",
        publicKey: String = "public",
        authKey: String = "auth",
        loadSession: suspend () -> MemberSession? = { session("quiet-fox") },
        registerEndpoint: suspend (MemberSession, String, String, String) -> Boolean = { _, _, _, _ -> true },
        saveEndpoint: (String) -> String? = { null },
        unregisterEndpoint: suspend (MemberSession, String) -> Unit = { _, _ -> },
        setStatus: (String) -> Unit = {},
    ) = handleMessageEndpointRegistration(
        account = account,
        endpointUrl = endpointUrl,
        publicKey = publicKey,
        authKey = authKey,
        loadSession = loadSession,
        registerEndpoint = registerEndpoint,
        saveEndpoint = saveEndpoint,
        unregisterEndpoint = unregisterEndpoint,
        setStatus = setStatus,
        registrationFailedMessage = "Could not register this distributor endpoint with Trustroots.",
        registrationSucceededMessage = "Message alerts are ready.",
    )

    private fun session(username: String) = MemberSession(
        "connect.sid=fake-session",
        MobileMember(username, username.replaceFirstChar(Char::uppercase)),
    )
}
