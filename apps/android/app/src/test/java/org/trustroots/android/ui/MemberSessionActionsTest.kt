package org.trustroots.android.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

class MemberSessionActionsTest {
    @Test fun updatingAnExistingMemberPersistsAndReturnsTheUpdatedSession() {
        val original = session()
        val updatedMember = MobileMember("steady-heron", "Steady Heron Updated")
        val saved = mutableListOf<MemberSession>()

        val result = updatePersistedMember(original, updatedMember, saved::add)

        assertEquals(original, session())
        assertEquals(original.copy(member = updatedMember), result)
        assertEquals(listOf(original.copy(member = updatedMember)), saved)
    }

    @Test fun aLateMemberUpdateAfterLogoutDoesNotSaveOrRestoreTheSession() {
        val saved = mutableListOf<MemberSession>()

        val result = updatePersistedMember(null, MobileMember("steady-heron", "Updated Name"), saved::add)

        assertNull(result)
        assertTrue(saved.isEmpty())
    }

    @Test fun clearingAnActiveSessionNormalisesCacheOriginAndRepeatedClearOnlyClearsTheStore() {
        val actions = mutableListOf<String>()
        val clearCache: (String, String) -> Unit = { server, account -> actions += "cache:$server:$account" }
        val clearStore: () -> Unit = { actions += "store" }

        clearPersistedSession(session(), "  https://api.example.test///  ", clearCache, clearStore)
        clearPersistedSession(null, "  https://api.example.test///  ", clearCache, clearStore)

        assertEquals(
            listOf("cache:https://api.example.test:steady-heron", "store", "store"),
            actions,
        )
    }

    @Test fun cacheClearFailurePropagatesBeforeTheSessionStoreIsCleared() {
        val failure = IllegalStateException("Cache clear failed")
        var storeCleared = false

        val thrown = runCatching {
            clearPersistedSession(
                session(),
                "https://api.example.test",
                clearCache = { _, _ -> throw failure },
                clearSession = { storeCleared = true },
            )
        }.exceptionOrNull()

        assertSame(failure, thrown)
        assertFalse(storeCleared)
    }

    private fun session() = MemberSession(
        cookieHeader = "connect.sid=fictional-session",
        member = MobileMember("steady-heron", "Steady Heron"),
    )
}
