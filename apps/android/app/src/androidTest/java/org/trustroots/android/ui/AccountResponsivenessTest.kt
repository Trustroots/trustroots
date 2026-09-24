package org.trustroots.android.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlinx.coroutines.launch
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class AccountResponsivenessTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun accountBackRemainsResponsiveDuringSlowCheck() {
        val responder = thread {
            server.accept().use { socket ->
                val input = socket.getInputStream().bufferedReader()
                input.readLine()
                while (!input.readLine().isNullOrEmpty()) Unit
                Thread.sleep(2_000)
                val bytes = """{"username":"steady-heron"}""".toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(bytes)
                socket.getOutputStream().flush()
            }
        }
        val backPressed = AtomicBoolean(false)
        compose.setContent {
            val scope = rememberCoroutineScope()
            var running by remember { mutableStateOf(false) }
            val session = remember {
                MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron"))
            }
            AccountScreen(
                session = session,
                accountMessage = null,
                isActionRunning = running,
                actionLabel = if (running) "Checking account…" else null,
                onBack = { backPressed.set(true) },
                onCheckAccount = {
                    running = true
                    scope.launch {
                        MobileApiClient("http://127.0.0.1:${server.localPort}").currentMember(session)
                        running = false
                    }
                },
                onResetPassword = {},
                onSignedOut = {},
            )
        }
        compose.onNodeWithText("Check account").performClick()
        compose.onNodeWithText("Checking account…").assertIsDisplayed()
        compose.onNodeWithText("‹ Back").performClick()
        compose.waitUntil(1_000) { backPressed.get() }
        responder.join(4_000)
    }
}
