package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
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

    private var headerHeight: (() -> Dp)? = null

    private fun setCurrentContent() {
        compose.setContent {
            val header = rememberSnappableCollapseHeader(
                expandedHeaderHeight = { expandedHeight },
                compactHeaderHeight = { compactHeight },
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
}
