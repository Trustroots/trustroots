package org.trustroots.android.notifications

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MessageAlertsLifecycleEdgeJourneyTest {
    @get:Rule val testName = TestName()

    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val server = ServerSocket(0).apply { soTimeout = 1_500 }
    private val requests = CopyOnWriteArrayList<String>()
    private val activeSocket = AtomicReference<Socket?>()
    private val probeFailure = AtomicReference<Throwable?>()
    private var responder: Thread? = null
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null
    private var previousDestination: MessageDestination? = null

    @Before fun isolateAlertState() {
        previousPreferences = preferences.all
        previousStatus = MessageAlerts.status.value
        previousDestination = MessageAlerts.destination.value
        preferences.edit().clear().commit()
        MessageAlerts.status.value = null
        MessageAlerts.destination.value = null
        startNoRequestProbe()
    }

    @After fun restoreAlertState() {
        try {
            server.close()
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder?.join(2_000)
            assertTrue("The local API probe should stop after shutdown", responder?.isAlive != true)
            probeFailure.get()?.let { throw AssertionError("The local API probe failed", it) }
        } finally {
            try {
                restorePreferences(preferences, previousPreferences)
            } finally {
                MessageAlerts.status.value = previousStatus
                MessageAlerts.destination.value = previousDestination
            }
        }
    }

    @Test fun unregisterCallbackForDisabledAccountPreservesItsSavedState() {
        preferences.edit()
            .putString("account", "quiet-fox")
            .putBoolean("enabled", false)
            .putString("endpoint", "http://127.0.0.1/retained-endpoint")
            .commit()
        MessageAlerts.status.value = "Alerts were turned off locally."

        val result = MessageAlerts.onDistributorUnregistered(context, baseUrl()) {
            error("A disabled account must not load a session")
        }
        awaitNoUnexpectedRequest()

        assertNull(result)
        assertEquals("quiet-fox", preferences.getString("account", null))
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertEquals("http://127.0.0.1/retained-endpoint", MessageAlerts.endpoint(context))
        assertEquals("Alerts were turned off locally.", MessageAlerts.status.value)
        assertTrue("An opted-out account must not trigger an API delete", requests.isEmpty())
    }

    @Test fun disablingAlertsWithoutARegisteredEndpointOnlyClearsLocalState() = runBlocking {
        preferences.edit()
            .putString("account", "quiet-fox")
            .putBoolean("enabled", true)
            .commit()
        MessageAlerts.status.value = "Waiting for distributor registration."
        var unregisterCalls = 0

        MessageAlerts.disable(context, session(), baseUrl()) { unregisterCalls++ }
        awaitNoUnexpectedRequest()

        assertEquals(1, unregisterCalls)
        assertTrue(preferences.all.isEmpty())
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertNull(MessageAlerts.endpoint(context))
        assertNull(MessageAlerts.status.value)
        assertTrue("No endpoint means no server-side unregister request", requests.isEmpty())
    }

    private fun baseUrl() = "http://127.0.0.1:${server.localPort}"

    private fun session() = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("quiet-fox", "Quiet Fox"),
    )

    private fun startNoRequestProbe() {
        responder = thread(isDaemon = true, name = "message-alerts-no-request-probe-${testName.methodName}") {
            try {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    return@thread
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread
                    throw error
                }
                activeSocket.set(socket)
                socket.soTimeout = 1_000
                socket.use {
                    val input = socket.getInputStream()
                    val request = input.readAsciiLine() ?: throw EOFException("Missing local API request")
                    requests += request
                    var contentLength = 0
                    while (true) {
                        val header = input.readAsciiLine() ?: throw EOFException("Incomplete local API headers")
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    input.readExactBytes(contentLength)
                    val response = "{}".toByteArray(Charsets.UTF_8)
                    socket.getOutputStream().apply {
                        write(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(response)
                        flush()
                    }
                }
            } catch (error: SocketException) {
                if (!server.isClosed) probeFailure.compareAndSet(null, error)
            } catch (error: Throwable) {
                probeFailure.compareAndSet(null, error)
            } finally {
                activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            }
        }
    }

    private fun awaitNoUnexpectedRequest() {
        responder?.join(2_000)
        assertTrue("The request probe should complete", responder?.isAlive != true)
        probeFailure.get()?.let { throw AssertionError("The local API probe failed", it) }
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

    private companion object {
        const val PREFERENCES_NAME = "message-alerts"
    }
}

private fun java.io.InputStream.readAsciiLine(): String? {
    val bytes = ByteArrayOutputStream()
    var previous = -1
    while (true) {
        val next = read()
        if (next < 0) return if (bytes.size() == 0) null else String(bytes.toByteArray(), Charsets.US_ASCII)
        if (previous == '\r'.code && next == '\n'.code) {
            val line = bytes.toByteArray()
            return String(line, 0, line.size - 1, Charsets.US_ASCII)
        }
        bytes.write(next)
        previous = next
    }
}

private fun java.io.InputStream.readExactBytes(contentLength: Int): ByteArray {
    val body = ByteArray(contentLength)
    var offset = 0
    while (offset < contentLength) {
        val count = read(body, offset, contentLength - offset)
        if (count < 0) throw EOFException("Request body ended after $offset of $contentLength bytes")
        offset += count
    }
    return body
}
