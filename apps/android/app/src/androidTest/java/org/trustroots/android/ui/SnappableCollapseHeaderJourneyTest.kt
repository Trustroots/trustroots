package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.common.rememberSnappableCollapseHeader

private val expandedHeight = 300.dp
private val compactHeight = 60.dp

@RunWith(AndroidJUnit4::class)
class SnappableCollapseHeaderJourneyTest {
    @get:Rule val compose = createComposeRule()

    private data class HeaderConfiguration(
        val key: String,
        val expandedHeight: Dp,
        val compactHeight: Dp,
    )

    private var configuration by mutableStateOf(HeaderConfiguration("first", expandedHeight, compactHeight))
    private var headerHeight: (() -> Dp)? = null

    private fun setCurrentContent() {
        compose.setContent {
            val currentConfiguration = configuration
            val header = rememberSnappableCollapseHeader(
                expandedHeaderHeight = { currentConfiguration.expandedHeight },
                compactHeaderHeight = { currentConfiguration.compactHeight },
                key = currentConfiguration.key,
            )
            headerHeight = { header.headerHeight }
            Column(Modifier.fillMaxSize().nestedScroll(header.connection)) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(header.headerHeight)
                        .clipToBounds()
                        .testTag("collapsibleHeader"),
                )
                Column(
                    Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .testTag("collapsibleContent"),
                ) {
                    Spacer(Modifier.height(400.dp))
                }
            }
        }
    }

    @Test fun scrollingContentCollapsesHeader() {
        setCurrentContent()
        compose.onNodeWithTag("collapsibleContent").performTouchInput { swipeUp() }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(compactHeight, requireNotNull(headerHeight).invoke())
        }
    }

    @Test fun scrollingBackReopensHeader() {
        setCurrentContent()
        compose.onNodeWithTag("collapsibleContent").performTouchInput { swipeUp() }
        compose.waitForIdle()
        compose.onNodeWithTag("collapsibleContent").performTouchInput { swipeDown() }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(expandedHeight, requireNotNull(headerHeight).invoke())
        }
    }

    @Test fun updatedHeightsAndKeyResetUseLatestConfiguration() {
        setCurrentContent()
        compose.onNodeWithTag("collapsibleContent").performTouchInput { swipeUp() }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(compactHeight, requireNotNull(headerHeight).invoke())
            configuration = HeaderConfiguration("first", 400.dp, 80.dp)
        }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(
                "Changed height lambdas apply while retaining the current collapse offset",
                160.dp,
                requireNotNull(headerHeight).invoke(),
            )
        }
        compose.waitForIdle()
        compose.onNodeWithTag("collapsibleContent").performTouchInput { swipeUp() }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(
                "The updated scroll connection collapses to the new compact height",
                80.dp,
                requireNotNull(headerHeight).invoke(),
            )
            configuration = HeaderConfiguration("second", 400.dp, 80.dp)
        }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(
                "Changing the key resets the saved collapse offset",
                400.dp,
                requireNotNull(headerHeight).invoke(),
            )
        }
        compose.onNodeWithTag("collapsibleContent").performTouchInput { swipeUp() }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(
                "The keyed scroll connection still uses the latest compact height",
                80.dp,
                requireNotNull(headerHeight).invoke(),
            )
        }
    }
}
