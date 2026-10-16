package org.trustroots.android.api

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.LinkedBlockingQueue
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CircleMembershipRemovalJourneyTest {
    @Test fun leavingACircleUsesAuthenticatedDeleteAndInvalidatesProfileSnapshots() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cache = SecureResponseCache(context)
        val server = ServerSocket(0).apply { soTimeout = 20_000 }
        val base = "http://127.0.0.1:${server.localPort}"
        val account = "membership-removal-${System.nanoTime()}"
        val session = MemberSession("connect.sid=fictional-session", MobileMember(account, "Example Member"))
        val ownProfilePath = "/api/users/$account"
        val memberProfilePath = "/api/users/quiet-wren"
        val profileDetailsPath = "/api/contacts/member-one"
        val inboxPath = "/api/messages?page=1&limit=50"
        val received = LinkedBlockingQueue<String>()
        val responderFailure = java.util.concurrent.atomic.AtomicReference<Throwable?>()
        val activeSocket = java.util.concurrent.atomic.AtomicReference<java.net.Socket?>()
        val responder = thread(isDaemon = true, name = "circle-removal-local-api") {
            try {
                val socket = server.accept()
                activeSocket.set(socket)
                socket.use {
                    socket.soTimeout = 10_000
                    val input = socket.getInputStream().bufferedReader()
                    val requestLine = input.readLine().orEmpty()
                    val headers = mutableListOf<String>()
                    while (true) {
                        val header = input.readLine().orEmpty()
                        if (header.isEmpty()) break
                        headers += header
                    }
                    received.put((listOf(requestLine) + headers).joinToString("\n"))
                    val bytes = "{}".toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            } catch (error: SocketException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } catch (error: Throwable) {
                responderFailure.compareAndSet(null, error)
            } finally {
                activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            }
        }

        try {
            cache.save(base, account, ownProfilePath, "cached own profile")
            cache.save(base, account, memberProfilePath, "cached member profile")
            cache.save(base, account, profileDetailsPath, "cached contact details")
            cache.save(base, account, inboxPath, "cached inbox")

            MobileApiClient(base, cache, account)
                .setCircleMembership(session, "circle-one", isMember = true)
                .getOrThrow()

            val request = received.poll(5, java.util.concurrent.TimeUnit.SECONDS).orEmpty()
            val normalisedRequest = request.lowercase()
            assertTrue("Circle removal should use DELETE", request.startsWith("DELETE /api/users/memberships/circle-one HTTP/1.1\n"))
            assertTrue("Circle removal should carry the stored session", normalisedRequest.contains("cookie: connect.sid=fictional-session"))
            assertTrue("Mutations should carry the app request marker", normalisedRequest.contains("x-trustroots-request: 1"))
            assertNull(cache.load(base, account, ownProfilePath))
            assertNull(cache.load(base, account, memberProfilePath))
            assertNull(cache.load(base, account, profileDetailsPath))
            assertEquals("cached inbox", cache.load(base, account, inboxPath)?.body)
            responderFailure.get()?.let { throw AssertionError("The loopback API responder failed", it) }
        } finally {
            try {
                runCatching { server.close() }
                activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
                responder.join(1_000)
            } finally {
                cache.clear(base, account)
            }
        }
        assertTrue("The loopback API responder should exit after its response", !responder.isAlive)
    }
}
