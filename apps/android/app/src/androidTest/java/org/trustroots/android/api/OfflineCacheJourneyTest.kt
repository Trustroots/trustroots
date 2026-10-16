package org.trustroots.android.api

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.net.ServerSocket
import java.security.KeyStore
import java.util.concurrent.LinkedBlockingQueue
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import javax.crypto.Cipher
import javax.crypto.SecretKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OfflineCacheJourneyTest {
    @Test fun cacheEvictsOnlyTheRequestedCategoriesAndRejectsOversizedSnapshots() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cache = SecureResponseCache(context)
        val server = "https://cache-${System.nanoTime()}.example.test"
        val account = "cache-test-${System.nanoTime()}"
        val inboxPath = "/api/messages?page=1&limit=50"
        val profilePath = "/api/users/calm-lynx"
        try {
            cache.save(server, account, inboxPath, "fictional inbox")
            cache.save(server, account, profilePath, "fictional profile")
            cache.save(server, account, "/api/messages?page=2&limit=50", "x".repeat(512 * 1024 + 1))

            assertEquals("fictional inbox", cache.load(server, account, inboxPath)?.body)
            assertEquals("fictional profile", cache.load(server, account, profilePath)?.body)
            assertEquals(null, cache.load(server, account, "/api/messages?page=2&limit=50"))

            cache.clearCategories(server, account, setOf("inbox"))

            assertEquals(null, cache.load(server, account, inboxPath))
            assertEquals("fictional profile", cache.load(server, account, profilePath)?.body)
        } finally {
            cache.clear(server, account)
        }
    }

    @Test fun truncatedAndTamperedSnapshotsBecomeCacheMisses() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cache = SecureResponseCache(context)
        val server = "https://corrupt-cache-${System.nanoTime()}.example.test"
        val account = "cache-test-${System.nanoTime()}"
        val path = "/api/users/calm-lynx"
        val cacheRoot = File(context.noBackupFilesDir, "response-cache")
        val filesBefore = cacheRoot.walkTopDown().filter(File::isFile).map(File::getAbsolutePath).toSet()
        try {
            cache.save(server, account, path, "fictional profile")
            val file = cacheRoot.walkTopDown().filter(File::isFile)
                .single { it.absolutePath !in filesBefore }
            val validBytes = file.readBytes()
            assertEquals("fictional profile", cache.load(server, account, path)?.body)

            file.writeBytes(ByteArray(12))
            assertEquals(null, cache.load(server, account, path))

            val tamperedBytes = validBytes.copyOf().apply {
                this[lastIndex] = (this[lastIndex].toInt() xor 1).toByte()
            }
            file.writeBytes(tamperedBytes)
            assertEquals(null, cache.load(server, account, path))
        } finally {
            cache.clear(server, account)
        }
    }

    @Test fun authenticatedSnapshotsWithMalformedJsonBecomeCacheMisses() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cache = SecureResponseCache(context)
        val server = "https://malformed-cache-${System.nanoTime()}.example.test"
        val account = "cache-test-${System.nanoTime()}"
        val path = "/api/users/calm-lynx"
        val cacheRoot = File(context.noBackupFilesDir, "response-cache")
        val filesBefore = cacheRoot.walkTopDown().filter(File::isFile).map { it.absolutePath }.toSet()
        try {
            cache.save(server, account, path, "fictional profile")
            val file = cacheRoot.walkTopDown().filter(File::isFile)
                .single { it.absolutePath !in filesBefore }
            val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            val key = keyStore.getKey("org.trustroots.android.response-cache", null) as SecretKey
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key) }
            val invalidPayload = cipher.doFinal("not a JSON object".toByteArray(Charsets.UTF_8))

            file.writeBytes(cipher.iv + invalidPayload)

            assertEquals(null, cache.load(server, account, path))
        } finally {
            cache.clear(server, account)
        }
    }

    @Test fun mapSnapshotsStayWithinTheirConfiguredCacheLimit() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cache = SecureResponseCache(context)
        val server = "https://map-cache-${System.nanoTime()}.example.test"
        val account = "cache-test-${System.nanoTime()}"
        val paths = (1..5).map { page -> "/api/offers?southWestLat=$page" }
        try {
            paths.forEachIndexed { index, path -> cache.save(server, account, path, "fictional map $index") }

            assertEquals(4, paths.count { cache.load(server, account, it) != null })
        } finally {
            cache.clear(server, account)
        }
    }

    @Test fun successfulMessageMembershipAndAccountWritesInvalidateTheirCacheCategories() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cache = SecureResponseCache(context)
        val server = ServerSocket(0)
        val base = "http://127.0.0.1:${server.localPort}"
        val account = "cache-write-${System.nanoTime()}"
        val session = MemberSession("connect.sid=example", MobileMember(account, "Example Member"))
        val inboxPath = "/api/messages?page=1&limit=50"
        val threadPath = "/api/messages/member-one?limit=100"
        val ownProfilePath = "/api/users/$account"
        val otherProfilePath = "/api/users/calm-lynx"
        val detailPath = "/api/contacts/member-one"
        val requestLines = LinkedBlockingQueue<String>()
        val responses = listOf(
            """{"_id":"message-one","content":"A fictional reply","userFrom":{"username":"$account"}}""",
            "{}",
            """{"username":"$account","displayName":"Example Member","email":"member@example.test","newsletter":true}""",
        )
        val responder = thread(isDaemon = true) {
            responses.forEach { body ->
                val socket = runCatching { server.accept() }.getOrNull() ?: return@thread
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    requestLines.put(input.readLine().orEmpty())
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val bytes = body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                }
            }
        }
        try {
            cache.save(base, account, inboxPath, "cached inbox")
            cache.save(base, account, threadPath, "cached thread")
            cache.save(base, account, ownProfilePath, "cached own profile")
            cache.save(base, account, otherProfilePath, "cached member profile")
            cache.save(base, account, detailPath, "cached profile details")

            val api = MobileApiClient(base, cache, account)
            assertEquals("A fictional reply", api.sendMessage(session, "member-one", "A fictional reply").getOrThrow().content)
            assertEquals(null, cache.load(base, account, inboxPath))
            assertEquals(null, cache.load(base, account, threadPath))
            assertEquals("cached own profile", cache.load(base, account, ownProfilePath)?.body)
            assertEquals("cached member profile", cache.load(base, account, otherProfilePath)?.body)

            api.setCircleMembership(session, "circle-one", isMember = false).getOrThrow()
            assertEquals(null, cache.load(base, account, ownProfilePath))
            assertEquals(null, cache.load(base, account, otherProfilePath))
            assertEquals(null, cache.load(base, account, detailPath))

            cache.save(base, account, ownProfilePath, "cached own profile before account write")
            cache.save(base, account, detailPath, "cached profile details before account write")
            api.updateAccount(session, "member@example.test", newsletter = true).getOrThrow()
            assertEquals(null, cache.load(base, account, ownProfilePath))
            assertEquals("cached profile details before account write", cache.load(base, account, detailPath)?.body)

            assertEquals("POST /api/messages HTTP/1.1", requestLines.poll(5, java.util.concurrent.TimeUnit.SECONDS))
            assertEquals("POST /api/users/memberships/circle-one HTTP/1.1", requestLines.poll(5, java.util.concurrent.TimeUnit.SECONDS))
            assertEquals("PUT /api/users HTTP/1.1", requestLines.poll(5, java.util.concurrent.TimeUnit.SECONDS))
        } finally {
            server.close()
            responder.join(1_000)
            cache.clear(base, account)
        }
    }

    @Test fun recentMessageBodiesSurviveOfflineRestartWithoutPlaintextStorage() = runBlocking {
        val server = ServerSocket(0)
        val responder = thread(isDaemon = true) {
            val socket = runCatching { server.accept() }.getOrNull() ?: return@thread
            socket.use {
                val input = socket.getInputStream().bufferedReader()
                input.readLine()
                while (!input.readLine().isNullOrEmpty()) Unit
                val body = """[{"_id":"message-one","content":"A private greeting","userFrom":{"username":"calm-lynx"}}]"""
                val bytes = body.toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(bytes)
            }
        }
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cache = SecureResponseCache(context)
        val base = "http://127.0.0.1:${server.localPort}"
        val account = "message-cache-${System.nanoTime()}"
        val session = MemberSession("connect.sid=example", MobileMember(account, "Example Member"))
        try {
            assertEquals("A private greeting", MobileApiClient(base, cache, account)
                .conversation(session, "member-one").getOrThrow().single().content)
            responder.join(1_000)
            server.close()
            val restarted = MobileApiClient(base, cache, account)
            assertEquals("A private greeting", restarted.conversation(session, "member-one")
                .getOrThrow().single().content)
            assertNotNull(restarted.offlineSavedAt.value)
            val files = File(context.noBackupFilesDir, "response-cache").walkTopDown()
                .filter(File::isFile).toList()
            assertTrue(files.none { it.readBytes().toString(Charsets.UTF_8).contains("A private greeting") })
        } finally {
            server.close()
            responder.join(1_000)
            cache.clear(base, account)
        }
    }

    @Test fun cachedProfileIsScopedAndNeverReplacesAuthenticationFailure() = runBlocking {
        val server = ServerSocket(0)
        val responder = thread(isDaemon = true) {
            repeat(2) { index ->
                val socket = runCatching { server.accept() }.getOrNull() ?: return@thread
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val status = if (index == 0) "200 OK" else "401 Unauthorized"
                    val body = if (index == 0) {
                        """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}"""
                    } else """{"message":"Session expired"}"""
                    val bytes = body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                }
            }
        }
        val base = "http://127.0.0.1:${server.localPort}"
        val account = "cache-test-${System.nanoTime()}"
        val cache = SecureResponseCache(InstrumentationRegistry.getInstrumentation().targetContext)
        val api = MobileApiClient(base, cache, account)
        val session = MemberSession("connect.sid=example", MobileMember(account, "Example Member"))
        try {
            assertEquals("Quiet Fox", api.profile(session, "quiet-fox").getOrThrow().displayName)
            val rejected = api.profile(session, "quiet-fox").exceptionOrNull()
            assertTrue((rejected as MobileApiException).isAuthenticationFailure)
            assertEquals(null, api.offlineSavedAt.value)
            responder.join(1_000)
            server.close()
            assertEquals("Quiet Fox", api.profile(session, "quiet-fox").getOrThrow().displayName)
            assertNotNull(api.offlineSavedAt.value)
            val other = MobileApiClient(base, cache, "another-account")
            assertFalse(other.profile(session, "quiet-fox").isSuccess)
            api.clearCachedAccount()
            assertFalse(api.profile(session, "quiet-fox").isSuccess)
        } finally {
            server.close()
            responder.join(1_000)
            cache.clear(base, account)
        }
    }
}
