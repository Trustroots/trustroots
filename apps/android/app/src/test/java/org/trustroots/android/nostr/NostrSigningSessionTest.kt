package org.trustroots.android.nostr

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.shared.nostr.NostrAccountScope
import org.trustroots.shared.nostr.NostrSigningSession

/** Exercises common Kotlin without Android storage, framework or browser dependencies. */
class NostrSigningSessionTest {
    private val account = NostrAccountScope("https://example.test", "mira")

    @Test fun scopesAreCanonicalAndDistinct() {
        fun scope(server: String, member: String) = NostrAccountScope(server, member).storageAccount
        assertEquals("https://example.test", account.serverOrigin)
        assertEquals("mira", account.username)
        assertEquals("nostr-v1:20:https://example.test:4:mira", account.storageAccount)
        assertEquals(account.storageAccount, scope(" HTTPS://EXAMPLE.TEST/ ", " Mira "))
        assertNotEquals(account.storageAccount, scope("https://other.test", "mira"))
        assertNotEquals(account.storageAccount, scope("https://example.test", "robin"))
        assertNotEquals(scope("https://example.test:a", "b"), scope("https://example.test", "a:b"))
    }

    @Test fun signingRequiresAnActiveAccount() {
        val session = NostrSigningSession()
        assertNull(session.scope)
        assertFalse(session.isCurrent(session.revision))
        assertTrue(session.activate(account))
        assertEquals(account.storageAccount, session.scope?.storageAccount)
        assertTrue(session.isCurrent(session.revision))
        session.pause()
        assertNull(session.scope)
        assertFalse(session.isCurrent(session.revision))
    }

    @Test fun refreshingTheSameAccountKeepsCurrentWorkValid() {
        val session = NostrSigningSession()
        session.activate(account)
        val revision = session.revision
        assertFalse(session.activate(NostrAccountScope("https://example.test/", "MIRA")))
        assertEquals(revision, session.revision)
        assertTrue(session.isCurrent(revision))
    }

    @Test fun switchingAccountOrServerInvalidatesCapturedWork() {
        val session = NostrSigningSession()
        session.activate(account)
        val first = session.revision
        session.activate(NostrAccountScope("https://example.test", "robin"))
        assertFalse(session.isCurrent(first))
        val otherAccount = session.revision
        session.activate(NostrAccountScope("https://other.test", "robin"))
        assertFalse(session.isCurrent(otherAccount))
        session.activate(account)
        assertFalse(session.isCurrent(first))
        assertTrue(session.isCurrent(session.revision))
    }

    @Test fun signingOutAndReturningCannotResumeAnOldRequest() {
        val session = NostrSigningSession()
        session.activate(account)
        val first = session.revision
        session.pause()
        assertFalse(session.isCurrent(first))
        session.activate(account)
        assertFalse(session.isCurrent(first))
        assertTrue(session.isCurrent(session.revision))
    }

    @Test fun invalidatingAPausedSessionDoesNotEnableSigning() {
        val session = NostrSigningSession()
        session.activate(account)
        session.pause()
        session.invalidate()
        assertNull(session.scope)
        assertFalse(session.isCurrent(session.revision))
    }

    @Test fun keyChangesInvalidateWorkWithoutLosingAccountScope() {
        val session = NostrSigningSession()
        session.activate(account)
        val captured = session.revision
        session.invalidate()
        assertFalse(session.isCurrent(captured))
        assertEquals(account.storageAccount, session.scope?.storageAccount)
        assertTrue(session.isCurrent(session.revision))
    }
}
