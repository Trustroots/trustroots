package org.trustroots.android.updates

import android.content.Context
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class ApkUpdateAlertsHttpFailureTest {
    @Test
    fun releaseResponsesOutsideBothEndsOfTheSuccessRangeDoNotPostNotifications() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val context: Context = RuntimeEnvironment.getApplication()
            context.getSharedPreferences("apk-update-alerts", Context.MODE_PRIVATE)
                .edit().putBoolean("enabled", true).commit()

            for (status in listOf(0, 300)) {
                server.enqueue(MockResponse.Builder()
                    .status("HTTP/1.1 ${status.toString().padStart(3, '0')} Unsuccessful response")
                    .addHeader("Connection", "close")
                    .body("Not a release list")
                    .build())
                val result = ApkUpdateAlerts.checkNow(
                    context = context,
                    previewAlertsEnabled = true,
                    releasesUrl = server.url("/releases").toString(),
                    postNotification = { _, _, _ -> error("HTTP $status must not post an update") },
                )

                assertEquals("HTTP $status", ApkUpdateCheckResult.Unavailable, result)
                assertEquals("/releases", requireNotNull(server.takeRequest(5, TimeUnit.SECONDS)).url.encodedPath)
            }
        }
    }

    @Test
    fun nonSuccessfulReleaseResponseBecomesUnavailableWithoutPostingNotification() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 503, body = "Temporarily unavailable"))
            server.start()
            val context: Context = RuntimeEnvironment.getApplication()
            context.getSharedPreferences("apk-update-alerts", Context.MODE_PRIVATE)
                .edit().putBoolean("enabled", true).commit()

            val result = ApkUpdateAlerts.checkNow(
                context = context,
                previewAlertsEnabled = true,
                releasesUrl = server.url("/releases").toString(),
            )

            assertEquals(ApkUpdateCheckResult.Unavailable, result)
            val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
            assertEquals("/releases", request.url.encodedPath)
            assertEquals("application/vnd.github+json", request.headers["Accept"])
            assertTrue(request.headers["User-Agent"].orEmpty().startsWith("TrustrootsAndroid/"))
        }
    }
}
