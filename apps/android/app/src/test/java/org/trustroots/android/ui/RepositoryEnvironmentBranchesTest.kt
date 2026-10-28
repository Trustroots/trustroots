package org.trustroots.android.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.MobileApiCircleRepository

class RepositoryEnvironmentBranchesTest {
    @Test
    fun circleRepositoryReportsBackendCookieAndAccountChangesIndependently() {
        val original = MemberSession("fictional-cookie", MobileMember("quiet-heron", "Quiet Heron"))
        val repository = MobileApiCircleRepository(
            api = MobileApiClient("https://circles.example.test/"),
            session = original,
        )

        assertFalse(repository.updateApi(MobileApiClient("https://circles.example.test")))
        assertFalse(repository.updateSession(original))

        assertTrue(repository.updateApi(MobileApiClient("https://other-circles.example.test")))
        assertTrue(repository.updateSession(original.copy(cookieHeader = "renewed-fictional-cookie")))
        assertTrue(
            repository.updateSession(
                original.copy(
                    cookieHeader = "renewed-fictional-cookie",
                    member = MobileMember("calm-lynx", "Calm Lynx"),
                ),
            ),
        )

        assertFalse(
            repository.updateSession(
                original.copy(
                    cookieHeader = "renewed-fictional-cookie",
                    member = MobileMember("calm-lynx", "Calm Lynx"),
                ),
            ),
        )
    }
}
