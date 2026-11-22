package org.trustroots.android.nostr

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import javax.crypto.AEADBadTagException
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidNostrKeysTest {
    @Test fun keyPersistsEncryptedForItsAccountAndIsRemovedSeparately() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val username = "fixture-${UUID.randomUUID()}"
        val scope = nostrAccountScope("https://example.test", username)
        val original = AndroidNostrKeys(context, scope)
        val same = AndroidNostrKeys(context, nostrAccountScope("https://EXAMPLE.test:443/", username.uppercase()))
        val differentServer = AndroidNostrKeys(context, nostrAccountScope("https://other.test", username))
        val differentMember = AndroidNostrKeys(context, nostrAccountScope("https://example.test", "other-$username"))
        val imported = "0".repeat(63) + "1"
        try {
            val npub = original.import(imported)
            assertEquals(npub, same.publicKey())
            val nsec = requireNotNull(same.backup())
            assertEquals(npub, NostrKeyCodec.npub(NostrKeyCodec.import(nsec)))
            assertNull(differentServer.publicKey())
            assertNull(differentMember.publicKey())
            assertThrows(IllegalStateException::class.java) { same.generate() }
            val prefs = context.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
            val record = requireNotNull(prefs.getString(scope.storageAccount, null))
            assertFalse(record.contains(imported) || record.contains(nsec))
            val other = differentMember.generate()
            val oldRevision = original.revision()
            same.remove()
            assertNull(original.publicKey())
            same.generate()
            assertNull(original.browserPublicKey(oldRevision))
            assertEquals(64, original.browserPublicKey(original.revision())?.length)
            assertEquals(other, differentMember.publicKey())
        } finally {
            original.remove()
            differentMember.remove()
        }
    }

    @Test fun refusesProfileProofsAfterRemovalAndCiphertextFromAnotherAccount() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val firstScope = nostrAccountScope("https://example.test", "first-${UUID.randomUUID()}")
        val secondScope = nostrAccountScope("https://example.test", "second-${UUID.randomUUID()}")
        val first = AndroidNostrKeys(context, firstScope)
        val second = AndroidNostrKeys(context, secondScope)
        val preferences = context.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
        try {
            val publicKey = first.import("0".repeat(63) + "1")
            assertThrows(IllegalStateException::class.java) {
                first.signProfileChallenge(JSONObject(), "https://example.test", "different-key")
            }

            val record = requireNotNull(preferences.getString(firstScope.storageAccount, null))
            check(preferences.edit().putString(secondScope.storageAccount, record).commit())
            assertThrows(AEADBadTagException::class.java) { second.publicKey() }

            first.remove()
            assertThrows(IllegalStateException::class.java) {
                first.signProfileChallenge(JSONObject(), "https://example.test", publicKey)
            }
        } finally {
            first.remove()
            second.remove()
        }
    }
}
