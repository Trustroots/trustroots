package org.trustroots.android.nostr

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.security.KeyStore
import java.util.UUID
import javax.crypto.AEADBadTagException
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidNostrKeysTest {
    @Test fun failedWritesDoNotChangeTheIdentityOrAdvanceItsRevision() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val preferences = context.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
        val failingPreferences = object : SharedPreferences by preferences {
            override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor by preferences.edit() {
                override fun putString(key: String, value: String?): SharedPreferences.Editor = this
                override fun remove(key: String): SharedPreferences.Editor = this
                override fun commit(): Boolean = false
            }
        }
        val failingContext = object : ContextWrapper(context) {
            override fun getApplicationContext(): Context = this
            override fun getSharedPreferences(name: String, mode: Int) = failingPreferences
        }
        val scope = nostrAccountScope("https://example.test", "failing-write-${UUID.randomUUID()}")
        val keys = AndroidNostrKeys(failingContext, scope)
        val revision = keys.revision()

        assertThrows(IllegalStateException::class.java) { keys.import("0".repeat(63) + "1") }
        assertThrows(IllegalStateException::class.java) { keys.remove() }
        assertEquals(revision, keys.revision())
        assertNull(keys.publicKey())
    }

    @Test fun refusesToGenerateAReplacementKeystoreKeyWhenAnEncryptedRecordExists() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val preferences = context.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
        val scope = nostrAccountScope("https://example.test", "missing-keystore-${UUID.randomUUID()}")
        val missingAlias = "trustroots.test.nostr.${UUID.randomUUID()}"
        val keys = AndroidNostrKeys(context, scope, missingAlias)
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        check(preferences.edit().putString(scope.storageAccount, "AA==").commit())
        try {
            assertThrows(IllegalStateException::class.java) { keys.publicKey() }
            assertFalse(keyStore.containsAlias(missingAlias))
        } finally {
            keys.remove()
        }
    }

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

    @Test fun pairingsPersistForTheLocalKeyAndAreRemovedWithIt() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = nostrAccountScope("https://example.test", "paired-${UUID.randomUUID()}")
        val first = AndroidNostrKeys(context, scope)
        try {
            first.generate()
            val revision = first.revision()
            val pairings = JSONArray().put(JSONObject().put("transport", "fixture-secret"))
            first.savePairings(revision, pairings)
            assertEquals(pairings.toString(), AndroidNostrKeys(context, scope).loadPairings(revision).toString())

            first.remove()
            assertThrows(IllegalStateException::class.java) { first.loadPairings(revision) }
            assertThrows(IllegalStateException::class.java) { first.savePairings(revision, pairings) }
            val removedRevision = first.revision()
            assertThrows(IllegalStateException::class.java) { first.loadPairings(removedRevision) }
            assertThrows(IllegalStateException::class.java) { first.savePairings(removedRevision, pairings) }

            first.generate()
            assertThrows(IllegalStateException::class.java) { first.loadPairings(revision) }
            assertEquals(0, first.loadPairings(first.revision()).length())
        } finally {
            first.remove()
        }
    }
}
