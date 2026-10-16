package org.trustroots.android.notifications

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.unifiedpush.android.connector.data.PublicKeySet
import org.unifiedpush.android.connector.data.PushEndpoint

@RunWith(AndroidJUnit4::class)
class MessageAlertsAdapterJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<Pair<String, String>>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null

    @Before fun saveState() {
        previousPreferences = preferences.all
        previousStatus = MessageAlerts.status.value
        preferences.edit().clear().commit()
        MessageAlerts.status.value = null
    }

    @After fun restoreState() {
        try {
            server.close()
        } finally {
            try {
                activeSocket?.close()
            } finally {
                responder?.join(1_000)
            }
        }
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        previousPreferences.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
            }
        }
        editor.commit()
        MessageAlerts.status.value = previousStatus
    }

    @Test fun adaptersEnableReconcileRegisterAndUnregisterThroughLocalApi() {
        val baseUrl = "http://127.0.0.1:${server.localPort}"
        val session = MemberSession("connect.sid=fixture-session", MobileMember("quiet-fox", "Quiet Fox"))
        val responseCount = 12
        val configurationRequests = AtomicInteger()
        responder = thread(isDaemon = true) {
            var servedResponses = 0
            while (servedResponses < responseCount) {
                val socket = acceptOrStop() ?: break
                activeSocket = socket
                try {
                    socket.use {
                        val input = socket.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        var contentLength = 0
                        while (true) {
                            val header = input.readLine().orEmpty()
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val body = if (contentLength > 0) {
                            CharArray(contentLength).also { chars ->
                                var read = 0
                                while (read < chars.size) {
                                    val count = input.read(chars, read, chars.size - read)
                                    check(count >= 0) { "Local API request ended before its declared body length" }
                                    read += count
                                }
                            }.concatToString()
                        } else ""
                        requests += request to body
                        val response = if (request.startsWith("GET ")) {
                            when (configurationRequests.getAndIncrement()) {
                                3, 5 -> """{"enabled":false}"""
                                4 -> """{"enabled":true,"publicKey":""}"""
                                else -> """{"enabled":true,"publicKey":"fixture-vapid-key"}"""
                            }
                        } else "{}"
                        val bytes = response.toByteArray()
                        socket.getOutputStream().write(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        socket.getOutputStream().write(bytes)
                        socket.getOutputStream().flush()
                        servedResponses++
                    }
                } catch (error: IOException) {
                    if (server.isClosed) break else throw error
                } finally {
                    activeSocket = null
                }
            }
        }

        val enableResult = AtomicReference<String>()
        val enabledLatch = CountDownLatch(1)
        val registeredKey = AtomicReference<String>()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                MessageAlerts.enable(
                    activity = activity,
                    session = session,
                    onResult = { enableResult.set(it); enabledLatch.countDown() },
                    apiBaseUrl = baseUrl,
                    hasDistributors = { true },
                    chooseDistributor = { selected -> selected(true) },
                    registerDistributor = { registeredKey.set(it) },
                )
            }
            assertTrue("Enable did not complete", enabledLatch.await(10, TimeUnit.SECONDS))

            val noDistributorResult = AtomicReference<String>()
            val noDistributorLatch = CountDownLatch(1)
            scenario.onActivity { activity ->
                MessageAlerts.enable(
                    activity = activity,
                    session = session,
                    onResult = { noDistributorResult.set(it); noDistributorLatch.countDown() },
                    apiBaseUrl = baseUrl,
                    hasDistributors = { false },
                    chooseDistributor = { error("No distributor should be selected") },
                    registerDistributor = { error("No distributor should register") },
                )
            }
            assertTrue("Missing-distributor result did not complete", noDistributorLatch.await(10, TimeUnit.SECONDS))
            assertEquals("Install a UnifiedPush distributor such as ntfy, then try again.", noDistributorResult.get())

            val declinedResult = AtomicReference<String>()
            val declinedLatch = CountDownLatch(1)
            scenario.onActivity { activity ->
                MessageAlerts.enable(
                    activity = activity,
                    session = session,
                    onResult = { declinedResult.set(it); declinedLatch.countDown() },
                    apiBaseUrl = baseUrl,
                    hasDistributors = { true },
                    chooseDistributor = { selected -> selected(false) },
                    registerDistributor = { error("A declined distributor should not register") },
                )
            }
            assertTrue("Declined-distributor result did not complete", declinedLatch.await(10, TimeUnit.SECONDS))
            assertEquals("Choose a UnifiedPush distributor to enable message alerts.", declinedResult.get())

            val unconfiguredResult = AtomicReference<String>()
            val unconfiguredLatch = CountDownLatch(1)
            scenario.onActivity { activity ->
                MessageAlerts.enable(
                    activity = activity,
                    session = session,
                    onResult = { unconfiguredResult.set(it); unconfiguredLatch.countDown() },
                    apiBaseUrl = baseUrl,
                    hasDistributors = { error("An unconfigured server must stop before distributor lookup") },
                    chooseDistributor = { error("An unconfigured server must stop before selection") },
                    registerDistributor = { error("An unconfigured server must not register") },
                )
            }
            assertTrue("Unconfigured-server result did not complete", unconfiguredLatch.await(10, TimeUnit.SECONDS))
            assertEquals("Message alerts are not configured on this server.", unconfiguredResult.get())

            val blankKeySession = MemberSession(
                "connect.sid=fixture-session",
                MobileMember("silver-otter", "Silver Otter"),
            )
            val blankKeyResult = AtomicReference<String>()
            val blankKeyLatch = CountDownLatch(1)
            scenario.onActivity { activity ->
                MessageAlerts.enable(
                    activity = activity,
                    session = blankKeySession,
                    onResult = { blankKeyResult.set(it); blankKeyLatch.countDown() },
                    apiBaseUrl = baseUrl,
                    hasDistributors = { error("A blank server key must stop before distributor lookup") },
                    chooseDistributor = { error("A blank server key must stop before selection") },
                    registerDistributor = { error("A blank server key must not register") },
                )
            }
            assertTrue("Blank-key result did not complete", blankKeyLatch.await(10, TimeUnit.SECONDS))
            assertEquals("Message alerts are not configured on this server.", blankKeyResult.get())
            assertFalse(MessageAlerts.isEnabled(context, blankKeySession.member.username))
            assertEquals("quiet-fox", preferences.getString("account", null))
        }
        assertEquals("Waiting for your distributor to register message alerts.", enableResult.get())
        assertEquals("fixture-vapid-key", registeredKey.get())
        assertTrue(MessageAlerts.isEnabled(context, "quiet-fox"))

        val disabledReconcileDistributorLookups = AtomicInteger()
        val disabledReconcileRegistrations = AtomicInteger()
        val disabledReconcileJob = MessageAlerts.reconcile(
            context,
            session,
            apiBaseUrl = baseUrl,
            hasSavedDistributor = { disabledReconcileDistributorLookups.incrementAndGet(); true },
            registerDistributor = { disabledReconcileRegistrations.incrementAndGet() },
        )
        assertNotNull(disabledReconcileJob)
        try {
            waitForRequestCount(6)
            runBlocking { withTimeout(10_000) { disabledReconcileJob!!.join() } }
            assertEquals(0, disabledReconcileDistributorLookups.get())
            assertEquals(0, disabledReconcileRegistrations.get())
            assertTrue(MessageAlerts.isEnabled(context, "quiet-fox"))
            assertNull(MessageAlerts.endpoint(context))
            assertNull(MessageAlerts.status.value)
        } finally {
            disabledReconcileJob?.cancel()
        }

        val reconciledKey = AtomicReference<String>()
        val reconcileLatch = CountDownLatch(1)
        MessageAlerts.reconcile(
            context,
            session,
            apiBaseUrl = baseUrl,
            hasSavedDistributor = { true },
            registerDistributor = { reconciledKey.set(it); reconcileLatch.countDown() },
        )
        assertTrue("Reconcile did not register the saved distributor", reconcileLatch.await(10, TimeUnit.SECONDS))
        assertEquals("fixture-vapid-key", reconciledKey.get())

        MessageAlerts.reconcile(
            context,
            session,
            apiBaseUrl = baseUrl,
            hasSavedDistributor = { false },
            registerDistributor = { error("A missing saved distributor should not register") },
        )
        waitForRequestCount(8)

        preferences.edit().putString("endpoint", "https://push.invalid/old").commit()
        MessageAlerts.onEndpoint(
            context,
            PushEndpoint("https://push.invalid/new", PublicKeySet("fixture-public", "fixture-auth"), temporary = false),
            apiBaseUrl = baseUrl,
            loadSession = { session },
        )
        waitForRequestCount(10)
        waitForStatus("Message alerts are ready.")
        assertEquals("https://push.invalid/new", MessageAlerts.endpoint(context))

        MessageAlerts.status.value = "stale status"
        val distributorUnregistered = AtomicBoolean(false)
        runBlocking {
            MessageAlerts.disable(context, session, baseUrl) { distributorUnregistered.set(true) }
        }
        assertTrue(distributorUnregistered.get())
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertNull(MessageAlerts.endpoint(context))
        assertNull(MessageAlerts.status.value)

        preferences.edit().putString("account", "quiet-fox").putBoolean("enabled", true)
            .putString("endpoint", "https://push.invalid/stopped").commit()
        MessageAlerts.onDistributorUnregistered(context, baseUrl) { session }
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertEquals("Your push distributor stopped message alerts. Choose one again to resume.", MessageAlerts.status.value)
        waitForRequestCount(responseCount)
        assertEquals(
            listOf("GET", "GET", "GET", "GET", "GET", "GET", "GET", "GET", "POST", "DELETE", "DELETE", "DELETE"),
            requests.map { it.first.substringBefore(' ') },
        )
        assertEquals(8, requests.count { it.first.startsWith("GET /api/users/unified-push ") })
        assertTrue(requests.take(8).all { it.first.startsWith("GET /api/users/unified-push ") })
        val registration = JSONObject(requests[8].second)
        assertEquals("https://push.invalid/new", registration.getString("endpoint"))
        assertEquals("fixture-public", registration.getString("publicKey"))
        assertEquals("fixture-auth", registration.getString("auth"))
        assertEquals("https://push.invalid/old", JSONObject(requests[9].second).getString("endpoint"))
        assertEquals("https://push.invalid/new", JSONObject(requests[10].second).getString("endpoint"))
        assertEquals("https://push.invalid/stopped", JSONObject(requests[11].second).getString("endpoint"))
    }

    private fun waitForRequestCount(expected: Int) {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (System.nanoTime() < deadline && requests.size < expected) Thread.sleep(20)
        assertEquals("Unexpected local API request count", expected, requests.size)
    }

    private fun waitForStatus(expected: String) {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (System.nanoTime() < deadline && MessageAlerts.status.value != expected) Thread.sleep(20)
        assertEquals(expected, MessageAlerts.status.value)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    private companion object {
        const val PREFERENCES_NAME = "message-alerts"
    }
}
