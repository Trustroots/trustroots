package org.trustroots.android.notifications

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

class MessageEndpointRegistrationMetadataTest {
    @Test
    fun registrationCallbacksPublishMetadataForBothFailureAndSuccess() = runBlocking {
        val session = MemberSession("connect.sid=fictional-session", MobileMember("quiet-fox", "Quiet Fox"))
        val messages = mutableListOf<String>()
        val metadata = mutableListOf<MessageAlertStatusMetadata>()
        val failed = MessageAlertStatusMetadata(resourceId = 101, formatArgs = listOf("fictional failure"))
        val succeeded = MessageAlertStatusMetadata(resourceId = 202)

        handleMessageEndpointRegistration(
            account = "quiet-fox",
            endpointUrl = "https://push.example.test/fictional-endpoint",
            publicKey = "fictional-public-key",
            authKey = "fictional-auth-key",
            loadSession = { session },
            registerEndpoint = { _, _, _, _ -> false },
            saveEndpoint = { error("Failed registrations must not save endpoints") },
            unregisterEndpoint = { _, _ -> error("Failed registrations must not unregister endpoints") },
            setStatus = messages::add,
            registrationFailedMessage = "Registration failed",
            registrationSucceededMessage = "Registration succeeded",
            setStatusMetadata = metadata::add,
            registrationFailedMetadata = failed,
            registrationSucceededMetadata = succeeded,
        )
        handleMessageEndpointRegistration(
            account = "quiet-fox",
            endpointUrl = "https://push.example.test/fictional-endpoint",
            publicKey = "fictional-public-key",
            authKey = "fictional-auth-key",
            loadSession = { session },
            registerEndpoint = { _, _, _, _ -> true },
            saveEndpoint = { null },
            unregisterEndpoint = { _, _ -> },
            setStatus = messages::add,
            registrationFailedMessage = "Registration failed",
            registrationSucceededMessage = "Registration succeeded",
            setStatusMetadata = metadata::add,
            registrationFailedMetadata = failed,
            registrationSucceededMetadata = succeeded,
        )

        assertEquals(listOf("Registration failed", "Registration succeeded"), messages)
        assertEquals(listOf(failed, succeeded), metadata)
    }
}
