package org.trustroots.android.api

import android.content.Context
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MobileApiCacheWriteInvalidationTest {
    @Test
    fun sendingMessageInvalidatesInboxAndThreadButPreservesProfileSnapshots() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(
                MockResponse(
                    code = 200,
                    body = """{"_id":"fictional-message-id","content":"Hello","userFrom":{"username":"quiet-fox"}}""",
                ),
            )
            server.start()
            val account = "message-cache-${System.nanoTime()}"
            val context = RuntimeEnvironment.getApplication()
            val baseUrl = server.url("/").toString()
            val snapshots = createSnapshots(
                context,
                baseUrl,
                account,
                "/api/messages?page=1&limit=50" to "inbox",
                "/api/messages/member-one?limit=100" to "thread",
                "/api/users/member-one" to "profile",
            )

            val result = MobileApiClient(baseUrl, SecureResponseCache(context), account).sendMessage(
                MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox")),
                "member-one",
                "Hello",
            )

            assertTrue(result.isSuccess)
            snapshots.forEach { (category, file) ->
                if (category == "inbox" || category == "thread") assertFalse(file.exists())
                else assertTrue(file.exists())
            }
        }
    }

    @Test
    fun changingCircleMembershipInvalidatesProfileSnapshotsButPreservesMapAndOfferSnapshots() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 200, body = "{}"))
            server.enqueue(MockResponse(code = 200, body = "{}"))
            server.start()
            val account = "membership-cache-${System.nanoTime()}"
            val context = RuntimeEnvironment.getApplication()
            val baseUrl = server.url("/").toString()
            val snapshots = createSnapshots(
                context,
                baseUrl,
                account,
                "/api/users/$account" to "own-profile",
                "/api/users/member-one" to "profile",
                "/api/contacts/member-one" to "profile-detail",
                "/api/offers/offer-one" to "offer",
            )

            val api = MobileApiClient(baseUrl, SecureResponseCache(context), account)
            val session = MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox"))
            val joined = api.setCircleMembership(session, "fictional-circle", isMember = true)
            val left = api.setCircleMembership(session, "fictional-circle", isMember = false)

            assertTrue(joined.isSuccess)
            assertTrue(left.isSuccess)
            assertTrue(server.takeRequest()?.method == "DELETE")
            assertTrue(server.takeRequest()?.method == "POST")
            snapshots.forEach { (category, file) ->
                if (category in setOf("own-profile", "profile", "profile-detail")) assertFalse(file.exists())
                else assertTrue(file.exists())
            }
        }
    }

    @Test
    fun profileAndBlockWritesInvalidateOnlyTheirRelatedSnapshots() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 200, body = """{"username":"quiet-fox","displayName":"Quiet Fox"}"""))
            server.enqueue(MockResponse(code = 200, body = "{}"))
            server.start()
            val account = "profile-write-cache-${System.nanoTime()}"
            val context = RuntimeEnvironment.getApplication()
            val baseUrl = server.url("/").toString()
            val session = MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox"))
            val api = MobileApiClient(baseUrl, SecureResponseCache(context), account)

            val profileSnapshots = createSnapshots(
                context,
                baseUrl,
                account,
                "/api/users/$account" to "own-profile",
                "/api/users/member-one" to "profile",
                "/api/contacts/member-one" to "profile-detail",
            )
            val profileResult = api.updateProfile(
                session,
                ProfileUpdate("Quiet Fox", "", "", "", "", emptyList()),
            )

            assertTrue(profileResult.isSuccess)
            assertFalse(profileSnapshots.first { it.first == "own-profile" }.second.exists())
            assertTrue(profileSnapshots.filterNot { it.first == "own-profile" }.all { it.second.exists() })

            val blockSnapshots = createSnapshots(
                context,
                baseUrl,
                account,
                "/api/users/$account" to "own-profile",
                "/api/users/member-one" to "profile",
                "/api/contacts/member-one" to "profile-detail",
                "/api/offers/offer-one" to "offer",
            )
            val blockResult = api.setMemberBlocked(session, "member-one", blocked = true)

            assertTrue(blockResult.isSuccess)
            assertTrue(blockSnapshots.filter { it.first in setOf("profile", "profile-detail") }.all { !it.second.exists() })
            assertTrue(blockSnapshots.filterNot { it.first in setOf("profile", "profile-detail") }.all { it.second.exists() })
            assertEquals("PUT", server.takeRequest()?.method)
            assertEquals("PUT", server.takeRequest()?.method)
        }
    }

    private fun createSnapshots(
        context: Context,
        server: String,
        account: String,
        vararg pathsAndCategories: Pair<String, String>,
    ): List<Pair<String, File>> {
        val directory = File(
            File(context.noBackupFilesDir, "response-cache"),
            digest("${server.trimEnd('/')}|${account.lowercase()}"),
        )
        directory.mkdirs()
        return pathsAndCategories.map { (path, category) ->
            requireNotNull(cachePolicy(path, account))
            val file = File(directory, "$category-${digest(path)}")
            file.writeBytes(byteArrayOf(1, 2, 3))
            category to file
        }
    }

    private fun digest(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
