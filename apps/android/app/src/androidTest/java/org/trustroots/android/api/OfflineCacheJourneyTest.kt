package org.trustroots.android.api

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import java.io.File
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OfflineCacheJourneyTest {
    @Test fun recentMessageBodiesSurviveOfflineRestartWithoutPlaintextStorage() = runBlocking {
        val server = ServerSocket(0)
        val responder = thread(isDaemon = true) {
            server.accept().use { socket ->
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
            cache.clear(base, account)
        }
    }

    @Test fun cachedProfileIsScopedAndNeverReplacesAuthenticationFailure() = runBlocking {
        val server = ServerSocket(0)
        val responder = thread(isDaemon = true) {
            repeat(2) { index ->
                server.accept().use { socket ->
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
            cache.clear(base, account)
        }
    }
}
