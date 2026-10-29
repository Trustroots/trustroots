package org.trustroots.android.ui.profile

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.AccommodationOffer

@RunWith(AndroidJUnit4::class)
class ProfileHostingSectionJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun noOfferWithoutAnOptionalDescriptionShowsOnlyTheDefaultStatus() {
        compose.setContent {
            MaterialTheme {
                ProfileHostingSection(
                    hosting = AccommodationOffer(
                        status = "no",
                        description = null,
                        noOfferDescription = null,
                        maxGuests = null,
                    ),
                    hostingLoaded = true,
                )
            }
        }

        compose.onNodeWithText("Not hosting currently").assertIsDisplayed()
    }
}
