package org.trustroots.android.notifications

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.BuildConfig
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore

@RunWith(AndroidJUnit4::class)
class MessageAlertsPublicUnregistrationJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val messagePreferences
        get() = context.getSharedPreferences(MESSAGE_PREFERENCES, Context.MODE_PRIVATE)
    private val sessionPreferences
        get() = context.getSharedPreferences(SESSION_PREFERENCES, Context.MODE_PRIVATE)

    private var previousMessagePreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousSessionPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null
    private var previousDestination: MessageDestination? = null
    private var fixtureServer: ServerSocket? = null
    private val activeSocket = AtomicReference<Socket?>()
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val responderFailure = AtomicReference<Throwable?>()
    private val responseSent = CountDownLatch(1)
    private var responder: Thread? = null

    @Before
    fun saveAndIsolateState() {
        previousMessagePreferences = messagePreferences.all
        previousSessionPreferences = sessionPreferences.all
        previousStatus = MessageAlerts.status.value
        previousDestination = MessageAlerts.destination.value
        messagePreferences.edit().clear().commit()
        sessionPreferences.edit().clear().commit()
        MessageAlerts.status.value = null
        MessageAlerts.destination.value = null
    }

    @After
    fun stopFixtureAndRestoreState() {
        val cleanupFailures = mutableListOf<Throwable>()
        fun captureCleanup(action: () -> Unit) {
            try {
                action()
            } catch (error: Throwable) {
                cleanupFailures += error
            }
        }

        captureCleanup { fixtureServer?.close() }
        captureCleanup { activeSocket.getAndSet(null)?.close() }
        captureCleanup { responder?.join(5_000) }
        captureCleanup { check(responder?.isAlive != true) { "Local unregistration fixture did not stop" } }
        captureCleanup { restorePreferences(messagePreferences, previousMessagePreferences) }
        captureCleanup { restorePreferences(sessionPreferences, previousSessionPreferences) }
        captureCleanup { MessageAlerts.status.value = previousStatus }
        captureCleanup { MessageAlerts.destination.value = previousDestination }

        if (cleanupFailures.isNotEmpty()) {
            throw AssertionError("Could not fully restore public unregistration journey state").also { error ->
                cleanupFailures.forEach(error::addSuppressed)
            }
        }
    }

    @Test
    fun publicUnregistrationLoadsSavedSessionAndDeletesItsSavedEndpointLocally() {
        assumeTrue(
            "Public wrapper uses BuildConfig API_BASE_URL; configure it to the local fixture before this journey",
            BuildConfig.API_BASE_URL.trimEnd('/') == FIXTURE_BASE_URL,
        )

        val server = ServerSocket().apply {
            // The public wrappers share BuildConfig's localhost port across journeys.
            reuseAddress = true
            bind(InetSocketAddress("127.0.0.1", FIXTURE_PORT))
            soTimeout = 15_000
        }
        fixtureServer = server
        val session = MemberSession(
            cookieHeader = "connect.sid=fictional-unregistration-session",
            member = MobileMember("quiet-fox", "Quiet Fox"),
        )
        val oldEndpoint = "https://push.invalid/fictional-endpoint"
        SecureMobileSessionStore(context).save(session)
        assertEquals("The fixture session should be encrypted and loadable", session, SecureMobileSessionStore(context).load())
        messagePreferences.edit()
            .putString("account", session.member.username)
            .putBoolean("enabled", true)
            .putString("endpoint", oldEndpoint)
            .commit()
        MessageAlerts.status.value = "Waiting for the distributor"
        startResponder(server)

        MessageAlerts.onDistributorUnregistered(context)

        assertFalse("Unregistration should clear the local opt-in", MessageAlerts.isEnabled(context, session.member.username))
        assertTrue("Unregistration should remove the saved account and endpoint", messagePreferences.all.isEmpty())
        assertNull(MessageAlerts.endpoint(context))
        assertEquals(
            "Your push distributor stopped message alerts. Choose one again to resume.",
            MessageAlerts.status.value,
        )
        assertTrue("The public wrapper should send its API request", responseSent.await(10, TimeUnit.SECONDS))
        responder?.join(5_000)
        assertFalse("The local API responder should finish", responder?.isAlive == true)
        assertNull("The local API responder should not fail", responderFailure.get())

        assertEquals("The public wrapper should send exactly one DELETE", 1, requests.size)
        val captured = requests.single()
        assertEquals("DELETE /api/users/unified-push HTTP/1.1", captured.requestLine)
        assertEquals(session.cookieHeader, captured.cookie)
        assertEquals(oldEndpoint, JSONObject(captured.body).getString("endpoint"))
    }

    private fun startResponder(server: ServerSocket) {
        responder = thread(isDaemon = true, name = "public-message-unregister-api-fixture") {
            try {
                val socket = server.accept()
                activeSocket.set(socket)
                socket.use { connection ->
                    connection.soTimeout = 5_000
                    val input = connection.getInputStream().bufferedReader(Charsets.US_ASCII)
                    val requestLine = input.readLine().orEmpty()
                    var contentLength = 0
                    var cookie: String? = null
                    while (true) {
                        val header = input.readLine() ?: throw IOException("Fixture request ended before its header terminator")
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                        if (header.startsWith("Cookie:", ignoreCase = true)) {
                            cookie = header.substringAfter(':').trim()
                        }
                    }
                    val body = CharArray(contentLength)
                    var bodyOffset = 0
                    while (bodyOffset < contentLength) {
                        val count = input.read(body, bodyOffset, contentLength - bodyOffset)
                        if (count < 0) throw IOException("Fixture request body ended before Content-Length")
                        bodyOffset += count
                    }
                    requests += CapturedRequest(requestLine, cookie, body.concatToString())
                    val response = "{}".toByteArray(Charsets.UTF_8)
                    val output = connection.getOutputStream()
                    output.write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n"
                            .toByteArray(Charsets.US_ASCII),
                    )
                    output.write(response)
                    output.flush()
                    responseSent.countDown()
                }
            } catch (error: SocketTimeoutException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } catch (error: SocketException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } catch (error: Throwable) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } finally {
                activeSocket.set(null)
            }
        }
    }

    private fun restorePreferences(preferences: android.content.SharedPreferences, values: Map<String, *>) {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        values.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }

    private data class CapturedRequest(
        val requestLine: String,
        val cookie: String?,
        val body: String,
    )

    private companion object {
        const val MESSAGE_PREFERENCES = "message-alerts"
        const val SESSION_PREFERENCES = "mobile-session"
        const val FIXTURE_BASE_URL = "http://127.0.0.1:38081"
        const val FIXTURE_PORT = 38081
    }
}
