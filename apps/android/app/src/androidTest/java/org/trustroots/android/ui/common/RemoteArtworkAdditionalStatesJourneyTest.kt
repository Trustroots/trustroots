package org.trustroots.android.ui.common

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLConnection
import java.net.URLStreamHandler
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CancellationException
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RemoteArtworkAdditionalStatesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun compactAndExpandedArtworkCanRenderWithoutTheirTitles() {
        compose.setContent {
            MaterialTheme {
                Column {
                    ArtworkHero(
                        url = null,
                        sessionCookie = null,
                        label = "Compact hidden title",
                        subtitle = "Compact subtitle remains",
                        background = Color.Blue,
                        blurBackground = false,
                        testTag = "compactHiddenTitle",
                        compact = true,
                        showTitle = false,
                    )
                    ArtworkHero(
                        url = null,
                        sessionCookie = null,
                        label = "Expanded hidden title",
                        subtitle = "Expanded subtitle remains",
                        background = Color.Blue,
                        blurBackground = false,
                        testTag = "expandedHiddenTitle",
                        showTitle = false,
                    )
                }
            }
        }

        compose.onNodeWithText("Compact subtitle remains").assertIsDisplayed()
        compose.onNodeWithText("Expanded subtitle remains").assertIsDisplayed()
        compose.onNodeWithText("Compact hidden title").assertDoesNotExist()
        compose.onNodeWithText("Expanded hidden title").assertDoesNotExist()
    }

    @Test
    fun compactAndExpandedArtworkRenderTitlesWhenEnabled() {
        compose.setContent {
            MaterialTheme {
                Column {
                    ArtworkHero(
                        url = null,
                        sessionCookie = null,
                        label = "Compact visible title",
                        subtitle = "Compact subtitle",
                        background = Color.Blue,
                        blurBackground = false,
                        testTag = "compactVisibleTitle",
                        compact = true,
                        heroHeight = 160.dp,
                    )
                    ArtworkHero(
                        url = null,
                        sessionCookie = null,
                        label = "Expanded visible title",
                        subtitle = "Expanded subtitle",
                        background = Color.Blue,
                        blurBackground = false,
                        testTag = "expandedVisibleTitle",
                        heroHeight = 260.dp,
                    )
                }
            }
        }

        compose.onNodeWithText("Compact visible title").assertIsDisplayed()
        compose.onNodeWithText("Expanded visible title").assertIsDisplayed()
    }

    @Test
    fun artworkLoaderRethrowsCancellationInsteadOfConvertingItIntoFailure() {
        val requests = AtomicInteger()
        val url = throwingUrl(requests, CancellationException("Composition was cancelled"))

        compose.setContent {
            MaterialTheme {
                ArtworkStateLabel(url)
            }
        }

        compose.waitUntil(5_000) { requests.get() == 1 }
        compose.onNodeWithText("Artwork loading").assertIsDisplayed()
        compose.onNodeWithText("Artwork failed").assertDoesNotExist()
    }

    @Test
    fun artworkLoaderConvertsOtherConnectionErrorsIntoFailedState() {
        val requests = AtomicInteger()
        val url = throwingUrl(requests, IOException("Anonymous image transport failure"))

        compose.setContent {
            MaterialTheme {
                ArtworkStateLabel(url)
            }
        }

        compose.waitUntil(5_000) { requests.get() == 1 }
        compose.onNodeWithText("Artwork failed").assertIsDisplayed()
    }

    @Composable
    private fun ArtworkStateLabel(url: URL) {
        val state = rememberArtworkBitmapState(url, sessionCookie = null)
        Text(
            when (state) {
                ArtworkBitmapState.Loading -> "Artwork loading"
                ArtworkBitmapState.Failed -> "Artwork failed"
                is ArtworkBitmapState.Loaded -> "Artwork loaded"
            },
        )
    }

    private fun throwingUrl(requests: AtomicInteger, error: Exception): URL = URL(
        null,
        "http://artwork.invalid/${System.nanoTime()}/avatar",
        object : URLStreamHandler() {
            override fun openConnection(url: URL): URLConnection {
                requests.incrementAndGet()
                return object : HttpURLConnection(url) {
                    override fun connect() = Unit
                    override fun disconnect() = Unit
                    override fun usingProxy(): Boolean = false
                    override fun getResponseCode(): Int = throw error
                }
            }
        },
    )
}
