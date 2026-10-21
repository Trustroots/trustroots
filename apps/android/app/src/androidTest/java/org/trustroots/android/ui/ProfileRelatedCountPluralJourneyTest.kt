package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.activity.ComponentActivity
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.ui.profile.ProfileContactsSection
import org.trustroots.android.ui.profile.ProfileOverviewSection
import org.trustroots.android.ui.profile.ProfileSection
import org.trustroots.android.ui.profile.ProfileSectionBar
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ProfileRelatedCountPluralJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun profileTabsAndExpandLinksUseCorrectZeroOneAndTwoCountLabels() {
        val api = MobileApiClient("https://example.invalid")
        val session = MemberSession("connect.sid=fictional-profile-count-session", MobileMember("steady-heron", "Steady Heron"))
        compose.setContent {
            TrustrootsTheme {
                Column {
                    ProfileSectionBar(ProfileSection.About, 0, {})
                    ProfileSectionBar(ProfileSection.About, 1, {})
                    ProfileSectionBar(ProfileSection.About, 2, {})
                    ProfileContactsSection(List(7, ::contact), false, {}, {}, api, session)
                    ProfileContactsSection(List(8, ::contact), false, {}, {}, api, session)
                    ProfileOverviewSection(List(7, ::reference), false, {}, {}, api, session)
                    ProfileOverviewSection(List(8, ::reference), false, {}, {}, api, session)
                }
            }
        }

        compose.onNodeWithText("Contacts").assertExists()
        compose.onNodeWithText("Contacts (1)").assertExists()
        compose.onNodeWithText("Contacts (2)").assertExists()
        compose.onNodeWithText("1 more contact").assertExists()
        compose.onNodeWithText("2 more contacts").assertExists()
        compose.onNodeWithText("1 more experience").assertExists()
        compose.onNodeWithText("2 more experiences").assertExists()
    }

    private fun contact(index: Int) = ProfileContact(
        id = "fictional-contact-$index",
        user = MessageMember(id = null, username = "fictional-member-$index", displayName = "Fictional Member $index"),
    )

    private fun reference(index: Int) = ProfileReference(
        id = "fictional-experience-$index",
        author = MessageMember(id = null, username = "fictional-member-$index", displayName = "Fictional Member $index"),
        feedback = null,
        recommendation = "yes",
        response = null,
    )
}
