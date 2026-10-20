package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.common.hostGuestCountLabel
import org.trustroots.android.ui.common.mapCommunityNoteCountLabel
import org.trustroots.android.ui.common.mapOfferCountLabel
import org.trustroots.android.ui.common.mapStatisticsLabel
import org.trustroots.android.ui.common.memberLocationLabel

@RunWith(AndroidJUnit4::class)
class CountLabelsJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun guestOfferAndCommunityNoteCountsUseSingularOnlyForOne() {
        compose.setContent {
            Column {
                Text(hostGuestCountLabel(0))
                Text(hostGuestCountLabel(1))
                Text(hostGuestCountLabel(4))
                Text(mapOfferCountLabel(0))
                Text(mapOfferCountLabel(1))
                Text(mapOfferCountLabel(4))
                Text(mapCommunityNoteCountLabel(0))
                Text(mapCommunityNoteCountLabel(1))
                Text(mapCommunityNoteCountLabel(4))
                Text(mapStatisticsLabel(1, 0))
                Text(mapStatisticsLabel(0, 1))
                Text(mapStatisticsLabel(4, 3))
            }
        }

        listOf(
            "Up to 0 guests", "Up to 1 guest", "Up to 4 guests",
            "0 offers", "1 offer", "4 offers",
            "0 community notes", "1 community note", "4 community notes",
            "1 offer · 0 Nostroots notes in this area",
            "0 offers · 1 Nostroots note in this area",
            "4 offers · 3 Nostroots notes in this area",
        ).forEach { compose.onNodeWithText(it).assertIsDisplayed() }
        compose.onNodeWithText("Up to 1 guests").assertDoesNotExist()
        compose.onNodeWithText("1 offers").assertDoesNotExist()
        compose.onNodeWithText("1 community notes").assertDoesNotExist()
    }

    @Test fun memberLocationUsesLivingValueOrLocalisedFromFallback() {
        compose.setContent {
            Column {
                memberLocationLabel("Fictional Harbour", "Imaginary Ridge")?.let { Text(it) }
                memberLocationLabel(null, "Imaginary Ridge")?.let { Text(it) }
                memberLocationLabel(null, null)?.let { Text(it) }
            }
        }

        compose.onNodeWithText("Fictional Harbour").assertIsDisplayed()
        compose.onNodeWithText("From Imaginary Ridge").assertIsDisplayed()
        compose.onNodeWithText("Imaginary Ridge").assertDoesNotExist()
    }
}
