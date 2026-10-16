package org.trustroots.android.api

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiCredentialValidationEdgesTest {
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))
    private val api = MobileApiClient("http://127.0.0.1:1")

    @Test fun rejectsBlankAccountEmailBeforeNetworkIo() {
        val result = runBlocking { api.updateAccount(session, "  ", newsletter = false) }

        assertValidationFailure(result)
    }

    @Test fun rejectsBlankPasswordFieldsAndMismatchedVerificationBeforeNetworkIo() {
        val invalidAttempts = listOf(
            runBlocking { api.changePassword(session, "  ", "fictional-new-password", "fictional-new-password") },
            runBlocking { api.changePassword(session, "fictional-current-password", "", "") },
            runBlocking { api.changePassword(session, "fictional-current-password", "fictional-new-password", "different-password") },
        )

        invalidAttempts.forEach(::assertValidationFailure)
    }

    private fun assertValidationFailure(result: Result<*>) {
        assertEquals(IllegalArgumentException::class.java, result.exceptionOrNull()?.javaClass)
    }
}
