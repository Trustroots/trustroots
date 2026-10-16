package org.trustroots.android.updates

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ApkUpdateHttpFailureJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private val requests = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()

    @Before fun isolateUpdateState() {
        previousPreferences = preferences.all
        preferences.edit().clear().putBoolean("enabled", true)
            .putInt("last-notified-version-code", LAST_NOTIFIED_VERSION).commit()
        startResponder()
    }

    @After fun restoreUpdateState() {
        try {
            server.close()
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder?.join(2_000)
            assertTrue("The local releases fixture should stop after shutdown", responder?.isAlive != true)
            responderFailure.get()?.let { throw AssertionError("The local releases fixture failed", it) }
        } finally {
            restorePreferences(preferences, previousPreferences)
        }
    }

    @Test fun httpErrorAndMalformedReleaseResponseAreUnavailableWithoutNotifying() = runBlocking {
        val releasesUrl = "http://127.0.0.1:${server.localPort}/fixture/releases"

        val httpError = ApkUpdateAlerts.checkNow(context, previewAlertsEnabled = true, releasesUrl = releasesUrl)
        val malformed = ApkUpdateAlerts.checkNow(context, previewAlertsEnabled = true, releasesUrl = releasesUrl)
        responder?.join(2_000)

        assertEquals(ApkUpdateCheckResult.Unavailable, httpError)
        assertEquals(ApkUpdateCheckResult.Unavailable, malformed)
        assertEquals(2, requests.size)
        assertTrue(requests.all { it.startsWith("GET /fixture/releases HTTP/1.1") })
        assertEquals(LAST_NOTIFIED_VERSION, preferences.getInt("last-notified-version-code", 0))
    }

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "apk-update-error-fixture") {
            try {
                repeat(2) { attempt ->
                    val socket = try {
                        server.accept()
                    } catch (error: SocketTimeoutException) {
                        throw AssertionError("Timed out waiting for release request ${attempt + 1}", error)
                    } catch (error: SocketException) {
                        if (server.isClosed) return@thread else throw error
                    }
                    activeSocket.set(socket)
                    try {
                        socket.soTimeout = 10_000
                        socket.use {
                            val input = socket.getInputStream().bufferedReader()
                            val request = input.readLine().orEmpty()
                            requests += request
                            while (true) {
                                val header = input.readLine() ?: throw EOFException("Incomplete releases request headers")
                                if (header.isEmpty()) break
                            }
                            val (status, body) = if (attempt == 0) {
                                "503 Service Unavailable" to """{"message":"Fixture service unavailable."}"""
                            } else {
                                "200 OK" to "not-json"
                            }
                            val bytes = body.toByteArray(Charsets.UTF_8)
                            socket.getOutputStream().apply {
                                write(
                                    "HTTP/1.1 $status\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                        .toByteArray(Charsets.US_ASCII),
                                )
                                write(bytes)
                                flush()
                            }
                        }
                    } catch (_: SocketException) {
                        // The HTTP client may close the local connection after an error response.
                    } catch (error: IOException) {
                        responderFailure.compareAndSet(null, error)
                    } catch (error: Throwable) {
                        responderFailure.compareAndSet(null, error)
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                        runCatching { socket.close() }
                    }
                }
            } catch (error: Throwable) {
                responderFailure.compareAndSet(null, error)
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

    private companion object {
        const val PREFERENCES_NAME = "apk-update-alerts"
        const val LAST_NOTIFIED_VERSION = 31_234
    }
}
