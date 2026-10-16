package org.trustroots.android.api

import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileApiExperienceValidationTest {
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("quiet-fox", "Quiet Fox"))

    @Test
    fun rejectsInvalidExperienceFieldsBeforeOpeningAnApiConnection() {
        val fixture = ExperienceApiFixture(maxRequests = 3)
        try {
            val client = MobileApiClient(fixture.baseUrl)
            val invalidExperiences = listOf(
                ExperienceCreate(
                    userTo = "  ", met = true, guest = false, host = false,
                    recommend = "yes", feedbackPublic = "A fictional note",
                ),
                ExperienceCreate(
                    userTo = "member-two", met = false, guest = false, host = false,
                    recommend = "no", feedbackPublic = "A fictional note",
                ),
                ExperienceCreate(
                    userTo = "member-two", met = false, guest = true, host = false,
                    recommend = "perhaps", feedbackPublic = "A fictional note",
                ),
            )

            invalidExperiences.forEach { experience ->
                val result = runBlocking { client.createExperience(session, experience) }
                assertTrue(result.exceptionOrNull() is IllegalArgumentException)
            }
        } finally {
            fixture.close()
        }

        assertTrue("invalid input must not reach the API fixture", fixture.requests.isEmpty())
        assertNull("local API responder failed", fixture.failure.get())
    }

    @Test
    fun createsGuestOnlyExperienceWithUnknownRecommendationAndTrimmedFeedback() {
        val fixture = ExperienceApiFixture(maxRequests = 1)
        try {
            val result = runBlocking {
                MobileApiClient(fixture.baseUrl).createExperience(
                    session,
                    ExperienceCreate(
                        userTo = "member-two",
                        met = false,
                        guest = true,
                        host = false,
                        recommend = "unknown",
                        feedbackPublic = "  A thoughtful guest  ",
                    ),
                )
            }
            result.getOrThrow()
        } finally {
            fixture.close()
        }

        val request = fixture.requests.single()
        assertEquals("POST /api/experiences HTTP/1.1", request.line)
        val body = JSONObject(request.body)
        assertEquals("member-two", body.getString("userTo"))
        val interactions = body.getJSONObject("interactions")
        assertFalse(interactions.getBoolean("met"))
        assertTrue(interactions.getBoolean("guest"))
        assertFalse(interactions.getBoolean("host"))
        assertEquals("unknown", body.getString("recommend"))
        assertEquals("A thoughtful guest", body.getString("feedbackPublic"))
        assertNull("local API responder failed", fixture.failure.get())
    }

    @Test
    fun createsHostOnlyExperienceWithNegativeRecommendation() {
        val fixture = ExperienceApiFixture(maxRequests = 1)
        try {
            val result = runBlocking {
                MobileApiClient(fixture.baseUrl).createExperience(
                    session,
                    ExperienceCreate(
                        userTo = "member-three",
                        met = false,
                        guest = false,
                        host = true,
                        recommend = "no",
                        feedbackPublic = "  A reliable host  ",
                    ),
                )
            }
            result.getOrThrow()
        } finally {
            fixture.close()
        }

        val request = fixture.requests.single()
        assertEquals("POST /api/experiences HTTP/1.1", request.line)
        val body = JSONObject(request.body)
        assertEquals("member-three", body.getString("userTo"))
        val interactions = body.getJSONObject("interactions")
        assertFalse(interactions.getBoolean("met"))
        assertFalse(interactions.getBoolean("guest"))
        assertTrue(interactions.getBoolean("host"))
        assertEquals("no", body.getString("recommend"))
        assertEquals("A reliable host", body.getString("feedbackPublic"))
        assertNull("local API responder failed", fixture.failure.get())
    }
}

private data class ExperienceApiRequest(val line: String, val body: String)

private class ExperienceApiFixture(private val maxRequests: Int) {
    private val server = ServerSocket(0).apply { soTimeout = TimeUnit.SECONDS.toMillis(5).toInt() }
    val baseUrl = "http://127.0.0.1:${server.localPort}"
    val requests = CopyOnWriteArrayList<ExperienceApiRequest>()
    val failure = AtomicReference<Throwable?>()
    @Volatile private var activeSocket: Socket? = null
    private val responder = thread(isDaemon = true, name = "experience-api-fixture") {
        try {
            repeat(maxRequests) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                activeSocket = socket
                try {
                    socket.use {
                        socket.soTimeout = 5_000
                        val reader = socket.getInputStream().bufferedReader()
                        val requestLine = reader.readLine() ?: throw EOFException("Missing request line")
                        var contentLength = 0
                        while (true) {
                            val header = reader.readLine() ?: throw EOFException("Incomplete request headers")
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toIntOrNull() ?: 0
                            }
                        }
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = reader.read(body, offset, body.size - offset)
                            if (count < 0) throw EOFException("Request body ended before Content-Length")
                            offset += count
                        }
                        requests += ExperienceApiRequest(requestLine, String(body))
                        val responseBody = "{}".toByteArray(Charsets.UTF_8)
                        socket.getOutputStream().write(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${responseBody.size}\r\nConnection: close\r\n\r\n".toByteArray(Charsets.UTF_8),
                        )
                        socket.getOutputStream().write(responseBody)
                        socket.getOutputStream().flush()
                    }
                } finally {
                    activeSocket = null
                }
            }
        } catch (error: IOException) {
            if (!server.isClosed) failure.set(error)
        } catch (error: Throwable) {
            failure.set(error)
        }
    }

    fun close() {
        try {
            server.close()
        } finally {
            try {
                activeSocket?.close()
            } finally {
                responder.join(TimeUnit.SECONDS.toMillis(2))
            }
        }
        assertFalse("local API responder should stop", responder.isAlive)
    }
}
