package org.trustroots.android.notifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import androidx.activity.ComponentActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.notifications.FakeUnifiedPushDistributorReceiver.RESULT_ACTION as UNIFIED_PUSH_FIXTURE_RESULT_ACTION
import org.trustroots.android.BuildConfig
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.unifiedpush.android.connector.UnifiedPush
import org.unifiedpush.android.connector.data.PublicKeySet
import org.unifiedpush.android.connector.data.PushEndpoint

@RunWith(AndroidJUnit4::class)
class PublicMessageAlertsUnifiedPushWrappersJourneyTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val targetContext get() = instrumentation.targetContext
    private val testContext get() = instrumentation.context
    private val alertPreferences get() = targetContext.getSharedPreferences(MESSAGE_PREFERENCES, Context.MODE_PRIVATE)
    private val sessionPreferences get() = targetContext.getSharedPreferences(SESSION_PREFERENCES, Context.MODE_PRIVATE)
    private val receiverComponent by lazy {
        ComponentName(testContext, FakeUnifiedPushDistributorReceiver::class.java)
    }

    private lateinit var server: ServerSocket
    private val requests = CopyOnWriteArrayList<ApiRequest>()
    private val distributorEvents = CopyOnWriteArrayList<DistributorEvent>()
    private val completedResponses = AtomicInteger()
    private val responderFailure = AtomicReference<Throwable?>(null)
    @Volatile private var activeSocket: Socket? = null
    private var responder: Thread? = null
    private var activityScenario: ActivityScenario<ComponentActivity>? = null
    private var resultReceiver: android.content.BroadcastReceiver? = null
    private var receiverRegistered = false
    private var receiverEnabledState = PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
    private var componentStateCaptured = false
    private var stateCaptured = false
    private var connectorStateTouched = false
    private var previousAlertPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousSessionPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null
    private var previousDestination: MessageDestination? = null

    @Test fun publicEnableExplainsWhenNoDistributorIsInstalled() {
        assumeTrue(
            "This instrumented journey only runs with its localhost API fixture configured",
            BuildConfig.API_BASE_URL.trimEnd('/') == FIXTURE_BASE_URL,
        )

        setUpIsolatedState()
        startFixtureServer()
        setFixtureComponentState(PackageManager.COMPONENT_ENABLED_STATE_DISABLED)
        assumeTrue(
            "The test must not alter a device with another installed UnifiedPush distributor",
            UnifiedPush.getDistributors(targetContext).isEmpty(),
        )
        activityScenario = ActivityScenario.launch(ComponentActivity::class.java)
        waitUntil("the target activity is resumed") {
            activityScenario?.state == Lifecycle.State.RESUMED
        }

        val session = MemberSession(
            cookieHeader = "connect.sid=fictional-push-session",
            member = MobileMember("steady-heron", "Steady Heron"),
        )
        val result = AtomicReference<String?>(null)
        activityScenario?.onActivity { activity ->
            MessageAlerts.enable(activity, session) { result.set(it) }
        }

        waitUntil("enable reports that no distributor is installed") {
            result.get() == "Install a UnifiedPush distributor such as ntfy, then try again."
        }
        assertEquals(1, countRequests("GET"))
        assertFalse(MessageAlerts.isEnabled(targetContext, session.member.username))
        assertTrue(alertPreferences.all.isEmpty())
        assertResponderHealthy()
    }

    @Test fun publicReconcileKeepsOptInWhenNoDistributorIsSaved() {
        assumeTrue(
            "This instrumented journey only runs with its localhost API fixture configured",
            BuildConfig.API_BASE_URL.trimEnd('/') == FIXTURE_BASE_URL,
        )

        setUpIsolatedState()
        startFixtureServer()
        registerFixtureResultReceiver()
        enableFakeDistributorComponent()
        activityScenario = ActivityScenario.launch(ComponentActivity::class.java)
        waitUntil("the target activity is resumed before opening the fake distributor") {
            activityScenario?.state == Lifecycle.State.RESUMED
        }
        launchFakeDistributorPackage()
        assumeTrue(
            "The fake distributor should be available to observe accidental registration",
            UnifiedPush.getDistributors(targetContext).toSet() == setOf(testContext.packageName),
        )
        assumeTrue(
            "The isolated app profile must not have a saved distributor",
            UnifiedPush.getSavedDistributor(targetContext) == null,
        )

        val session = MemberSession(
            cookieHeader = "connect.sid=fictional-push-session",
            member = MobileMember("steady-heron", "Steady Heron"),
        )
        alertPreferences.edit()
            .putString("account", session.member.username)
            .putBoolean("enabled", true)
            .putString("endpoint", "https://push.invalid/retained-endpoint")
            .commit()
        MessageAlerts.status.value = "Waiting for your distributor to register message alerts."

        val scopeJob = messageAlertsScopeJob()
        val existingJobs = scopeJob.children.toSet()
        MessageAlerts.reconcile(targetContext, session)

        waitUntil("public reconcile authenticates and completes its configuration request") {
            completedResponses.get() == 1
        }
        awaitNewMessageAlertJobs(scopeJob, existingJobs)

        val configuration = requests.single()
        assertEquals("GET", configuration.method)
        assertEquals("/api/users/unified-push", configuration.path)
        assertEquals(session.cookieHeader, configuration.cookie)
        assertTrue("A missing distributor must not emit REGISTER", distributorEvents.none { it.action == ACTION_REGISTER })
        assertEquals(session.member.username, alertPreferences.getString("account", null))
        assertTrue(alertPreferences.getBoolean("enabled", false))
        assertEquals("https://push.invalid/retained-endpoint", MessageAlerts.endpoint(targetContext))
        assertEquals("Waiting for your distributor to register message alerts.", MessageAlerts.status.value)
        assertNull(UnifiedPush.getSavedDistributor(targetContext))
        assertResponderHealthy()
    }

    @Test fun publicWrappersSelectDistributorReconcileRegisterEndpointAndDisableOffline() {
        // The debug BuildConfig must be supplied with -PtrustrootsApiUrl=http://127.0.0.1:38081.
        // This guard runs before any public wrapper can issue an API request.
        assumeTrue(
            "This instrumented journey only runs with its localhost API fixture configured",
            BuildConfig.API_BASE_URL.trimEnd('/') == FIXTURE_BASE_URL,
        )

        setUpIsolatedState()
        startFixtureServer()
        registerFixtureResultReceiver()
        enableFakeDistributorComponent()
        activityScenario = ActivityScenario.launch(ComponentActivity::class.java)
        waitUntil("the target activity is resumed before opening the fake distributor") {
            activityScenario?.state == Lifecycle.State.RESUMED
        }
        launchFakeDistributorPackage()

        // Do not overwrite a real saved or acknowledged distributor choice on a reused emulator.
        assumeTrue("A distributor is already selected in this app profile", UnifiedPush.getSavedDistributor(targetContext) == null)
        assumeTrue("A distributor acknowledgement already exists in this app profile", UnifiedPush.getAckDistributor(targetContext) == null)
        val distributors = UnifiedPush.getDistributors(targetContext)
        assumeTrue("The fixture receiver is not the only installed UnifiedPush distributor", distributors.toSet() == setOf(testContext.packageName))

        val session = MemberSession(
            cookieHeader = "connect.sid=fictional-push-session",
            member = MobileMember("steady-heron", "Steady Heron"),
        )
        SecureMobileSessionStore(targetContext).save(session)
        connectorStateTouched = true

        val enableResult = AtomicReference<String?>(null)
        activityScenario?.onActivity { activity ->
            MessageAlerts.enable(activity, session) { enableResult.set(it) }
        }
        waitUntil("enable callback reports selected distributor") {
            enableResult.get() == "Waiting for your distributor to register message alerts."
        }
        waitUntil("enable fetched configuration and sent REGISTER") {
            countRequests("GET") >= 1 && distributorEvents.any { it.action == ACTION_REGISTER }
        }
        assertEquals(testContext.packageName, UnifiedPush.getSavedDistributor(targetContext))
        assertRegisterPayload(distributorEvents.first { it.action == ACTION_REGISTER }, targetContext.packageName)
        assertTrue(MessageAlerts.isEnabled(targetContext, session.member.username))

        MessageAlerts.reconcile(targetContext, session)
        waitUntil("reconcile fetched configuration and sent a second REGISTER") {
            countRequests("GET") >= 2 && distributorEvents.count { it.action == ACTION_REGISTER } >= 2
        }
        assertEquals(testContext.packageName, UnifiedPush.getSavedDistributor(targetContext))
        assertRegisterPayload(distributorEvents.last { it.action == ACTION_REGISTER }, targetContext.packageName)

        val endpoint = "https://push.invalid/fictional-endpoint"
        val publicKey = "fictional-public-key"
        val authKey = "fictional-auth-key"
        MessageAlerts.onEndpoint(
            targetContext,
            PushEndpoint(endpoint, PublicKeySet(publicKey, authKey), temporary = false),
        )
        waitUntil("endpoint registration is stored and reported ready") {
            MessageAlerts.endpoint(targetContext) == endpoint && MessageAlerts.status.value == "Message alerts are ready." &&
                requests.any { it.method == "POST" }
        }
        val registration = requests.first { it.method == "POST" }
        val registrationBody = JSONObject(registration.body)
        assertTrue(registration.path.startsWith("/api/users/unified-push"))
        assertEquals(endpoint, registrationBody.getString("endpoint"))
        assertEquals(publicKey, registrationBody.getString("publicKey"))
        assertEquals(authKey, registrationBody.getString("auth"))
        assertEquals(session.cookieHeader, registration.cookie)

        runBlocking {
            withTimeout(8_000) { MessageAlerts.disable(targetContext, session) }
        }
        waitUntil("disable sent the fake distributor UNREGISTER broadcast") {
            distributorEvents.any { it.action == ACTION_UNREGISTER }
        }
        assertEquals(2, distributorEvents.count { it.action == ACTION_REGISTER })
        assertEquals(1, distributorEvents.count { it.action == ACTION_UNREGISTER })
        val unregistration = requests.first { it.method == "DELETE" }
        val unregistrationBody = JSONObject(unregistration.body)
        assertTrue(unregistration.path.startsWith("/api/users/unified-push"))
        assertEquals(endpoint, unregistrationBody.getString("endpoint"))
        assertEquals(session.cookieHeader, unregistration.cookie)
        assertTrue("Every wrapper request should use the supplied session", requests.all { it.cookie == session.cookieHeader })
        assertFalse(MessageAlerts.isEnabled(targetContext, session.member.username))
        assertEquals(null, MessageAlerts.endpoint(targetContext))
        assertEquals(null, MessageAlerts.status.value)
        val unregisterEvent = distributorEvents.last { it.action == ACTION_UNREGISTER }
        assertEquals(targetContext.packageName, unregisterEvent.targetPackage)
        assertTrue(unregisterEvent.token.isNotBlank())
        assertEquals(
            distributorEvents.first { it.action == ACTION_REGISTER }.token,
            unregisterEvent.token,
        )
        assertResponderHealthy()
    }

    @After fun restoreAllState() {
        try {
            if (connectorStateTouched) {
                runCatching { UnifiedPush.unregister(targetContext) }
                runCatching { UnifiedPush.removeDistributor(targetContext) }
            }
        } finally {
            try {
                activityScenario?.close()
                activityScenario = null
            } finally {
                try {
                    if (receiverRegistered) {
                        resultReceiver?.let { runCatching { targetContext.unregisterReceiver(it) } }
                        receiverRegistered = false
                    }
                } finally {
                    try {
                        stopFixtureServer()
                    } finally {
                        try {
                            if (stateCaptured) {
                                restorePreferences(alertPreferences, previousAlertPreferences)
                                restorePreferences(sessionPreferences, previousSessionPreferences)
                                MessageAlerts.status.value = previousStatus
                                MessageAlerts.destination.value = previousDestination
                            }
                        } finally {
                            if (componentStateCaptured) {
                                setFixtureComponentState(receiverEnabledState)
                            }
                        }
                    }
                }
            }
        }
    }

    private fun setUpIsolatedState() {
        previousAlertPreferences = alertPreferences.all
        previousSessionPreferences = sessionPreferences.all
        previousStatus = MessageAlerts.status.value
        previousDestination = MessageAlerts.destination.value
        receiverEnabledState = testContext.packageManager.getComponentEnabledSetting(receiverComponent)
        componentStateCaptured = true
        stateCaptured = true
        alertPreferences.edit().clear().commit()
        sessionPreferences.edit().clear().commit()
        MessageAlerts.status.value = null
        MessageAlerts.destination.value = null
    }

    private fun registerFixtureResultReceiver() {
        val receiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                distributorEvents += DistributorEvent(
                    action = intent.getStringExtra("action").orEmpty(),
                    targetPackage = intent.getStringExtra("targetPackage").orEmpty(),
                    token = intent.getStringExtra("token").orEmpty(),
                    message = intent.getStringExtra("message").orEmpty(),
                    vapid = intent.getStringExtra("vapid").orEmpty(),
                    application = intent.getStringExtra("application").orEmpty(),
                    features = intent.getStringArrayExtra("features")?.toList().orEmpty(),
                )
            }
        }
        resultReceiver = receiver
        ContextCompat.registerReceiver(
            targetContext,
            receiver,
            IntentFilter(UNIFIED_PUSH_FIXTURE_RESULT_ACTION),
            ContextCompat.RECEIVER_EXPORTED,
        )
        receiverRegistered = true
    }

    private fun enableFakeDistributorComponent() = setFixtureComponentState(PackageManager.COMPONENT_ENABLED_STATE_ENABLED)

    private fun launchFakeDistributorPackage() {
        targetContext.startActivity(
            Intent()
                .setComponent(ComponentName(testContext, FakeUnifiedPushDistributorLaunchActivity::class.java))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra("application", targetContext.packageName),
        )
        waitUntil("the fake distributor APK reports that it has launched") {
            distributorEvents.any { it.action == FIXTURE_LAUNCHED } &&
                activityScenario?.state == Lifecycle.State.RESUMED
        }
        assertEquals(targetContext.packageName, distributorEvents.first { it.action == FIXTURE_LAUNCHED }.targetPackage)
    }

    private fun setFixtureComponentState(state: Int) {
        val uiAutomation = instrumentation.uiAutomation
        uiAutomation.adoptShellPermissionIdentity("android.permission.CHANGE_COMPONENT_ENABLED_STATE")
        try {
            testContext.packageManager.setComponentEnabledSetting(
                receiverComponent,
                state,
                PackageManager.DONT_KILL_APP,
            )
        } finally {
            uiAutomation.dropShellPermissionIdentity()
        }
    }

    private fun startFixtureServer() {
        server = ServerSocket().apply {
            reuseAddress = true
            soTimeout = 300
            bind(java.net.InetSocketAddress(InetAddress.getByName("127.0.0.1"), FIXTURE_PORT))
        }
        responder = thread(isDaemon = true, name = "unified-push-public-wrapper-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else {
                        responderFailure.compareAndSet(null, error)
                        break
                    }
                } catch (error: IOException) {
                    responderFailure.compareAndSet(null, error)
                    break
                }
                activeSocket = socket
                try {
                    socket.use { connection ->
                        connection.soTimeout = 3_000
                        val input = connection.getInputStream()
                        val requestLine = readAsciiLine(input)
                            ?: throw EOFException("Fixture connection closed before its request line")
                        var contentLength = 0
                        var cookie = ""
                        while (true) {
                            val header = readAsciiLine(input) ?: break
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            } else if (header.startsWith("Cookie:", ignoreCase = true)) {
                                cookie = header.substringAfter(':').trim()
                            }
                        }
                        val bodyBytes = ByteArray(contentLength)
                        var offset = 0
                        while (offset < bodyBytes.size) {
                            val count = input.read(bodyBytes, offset, bodyBytes.size - offset)
                            if (count < 0) throw EOFException("Fixture request ended before Content-Length bytes arrived")
                            offset += count
                        }
                        val method = requestLine.substringBefore(' ')
                        val path = requestLine.split(' ').getOrElse(1) { "" }
                        val body = String(bodyBytes, Charsets.UTF_8)
                        requests += ApiRequest(method, path, body, cookie)
                        val payload = if (method == "GET") {
                            """{"enabled":true,"publicKey":"$FIXTURE_VAPID_KEY"}"""
                        } else "{}"
                        val bytes = payload.toByteArray(Charsets.UTF_8)
                        val status = if (path.startsWith("/api/users/unified-push")) "200 OK" else "404 Not Found"
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 $status\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                        if (status == "200 OK") completedResponses.incrementAndGet()
                    }
                } catch (error: SocketException) {
                    // A client may close a connection after cancelling its request.
                    if (server.isClosed) break
                } catch (error: IOException) {
                    if (!server.isClosed) responderFailure.compareAndSet(null, error)
                } catch (error: Throwable) {
                    responderFailure.compareAndSet(null, error)
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    private fun stopFixtureServer() {
        if (::server.isInitialized) {
            try {
                server.close()
            } finally {
                activeSocket?.close()
                responder?.join(2_000)
                assertTrue("The local API responder should stop after its socket closes", responder?.isAlive != true)
            }
        }
    }

    private fun assertRegisterPayload(event: DistributorEvent, expectedApplication: String) {
        assertEquals(ACTION_REGISTER, event.action)
        assertEquals(expectedApplication, event.application)
        assertEquals(expectedApplication, event.targetPackage)
        assertTrue(event.token.isNotBlank())
        assertEquals("Trustroots messages", event.message)
        assertEquals(FIXTURE_VAPID_KEY, event.vapid)
        assertTrue(event.features.contains("org.unifiedpush.android.distributor.feature.BYTES_MESSAGE"))
    }

    private fun countRequests(method: String): Int = requests.count { it.method == method }

    private fun waitUntil(description: String, condition: () -> Boolean) {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(8)
        while (System.nanoTime() < deadline) {
            responderFailure.get()?.let { throw AssertionError("Fixture server failed while waiting for $description", it) }
            if (condition()) return
            Thread.sleep(25)
        }
        throw AssertionError("Timed out waiting for $description")
    }

    private fun assertResponderHealthy() {
        responderFailure.get()?.let { throw AssertionError("Fixture server failed", it) }
    }

    private fun messageAlertsScopeJob(): Job {
        val scopeField = MessageAlerts::class.java.getDeclaredField("scope").apply { isAccessible = true }
        val scope = scopeField.get(MessageAlerts) as CoroutineScope
        return requireNotNull(scope.coroutineContext[Job])
    }

    private fun awaitNewMessageAlertJobs(scopeJob: Job, existingJobs: Set<Job>) = runBlocking {
        val startedJobs = scopeJob.children.filterNot { it in existingJobs }.toList()
        withTimeout(8_000) {
            startedJobs.forEach { it.join() }
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

    private data class ApiRequest(val method: String, val path: String, val body: String, val cookie: String)
    private data class DistributorEvent(
        val action: String,
        val targetPackage: String,
        val token: String,
        val message: String,
        val vapid: String,
        val application: String,
        val features: List<String>,
    )

    private companion object {
        const val MESSAGE_PREFERENCES = "message-alerts"
        const val SESSION_PREFERENCES = "mobile-session"
        const val FIXTURE_BASE_URL = "http://127.0.0.1:38081"
        const val FIXTURE_PORT = 38081
        const val FIXTURE_VAPID_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        const val ACTION_REGISTER = "org.unifiedpush.android.distributor.REGISTER"
        const val ACTION_UNREGISTER = "org.unifiedpush.android.distributor.UNREGISTER"
        const val FIXTURE_LAUNCHED = "fixture-launched"
    }
}

private fun readAsciiLine(input: InputStream): String? {
    val line = ByteArrayOutputStream()
    while (true) {
        val next = input.read()
        if (next < 0) return if (line.size() == 0) null else String(line.toByteArray(), Charsets.US_ASCII)
        if (next == '\n'.code) break
        if (next != '\r'.code) line.write(next)
    }
    return String(line.toByteArray(), Charsets.US_ASCII)
}
