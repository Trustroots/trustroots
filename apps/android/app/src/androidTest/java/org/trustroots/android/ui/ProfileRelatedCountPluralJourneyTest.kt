package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.assertCountEquals
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.activity.ComponentActivity
import java.util.concurrent.atomic.AtomicInteger
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
                    ProfileSectionBar(ProfileSection.About, 0, 0, {})
                    ProfileSectionBar(ProfileSection.About, 1, 1, {})
                    ProfileSectionBar(ProfileSection.About, 2, 2, {})
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
        compose.onAllNodesWithText("Experiences").assertCountEquals(3)
        compose.onNodeWithText("Experiences (1)").assertExists()
        compose.onNodeWithText("Experiences (2)").assertExists()
        compose.onNodeWithText("1 more contact").assertExists()
        compose.onNodeWithText("2 more contacts").assertExists()
        compose.onNodeWithText("1 more experience").assertExists()
        compose.onNodeWithText("2 more experiences").assertExists()
    }

    @Test
    fun profileRelatedEntriesWithoutUsernamesDoNotOpenRelatedProfiles() {
        val openedProfiles = AtomicInteger()
        val api = MobileApiClient("https://example.invalid")
        val session = MemberSession("connect.sid=fictional-profile-count-session", MobileMember("steady-heron", "Steady Heron"))
        compose.setContent {
            TrustrootsTheme {
                Column {
                    ProfileContactsSection(
                        contacts = listOf(
                            ProfileContact(
                                id = "anonymous-contact",
                                user = MessageMember(id = null, username = null, displayName = "Unnamed Contact"),
                            ),
                        ),
                        showAllContacts = false,
                        onToggleContacts = {},
                        onOpenRelated = { openedProfiles.incrementAndGet() },
                        api = api,
                        session = session,
                    )
                    ProfileOverviewSection(
                        references = listOf(
                            ProfileReference(
                                id = "anonymous-reference",
                                author = MessageMember(id = null, username = null, displayName = "Unnamed Author"),
                                feedback = "A fictional reference.",
                                recommendation = "yes",
                                response = null,
                            ),
                        ),
                        showAllReferences = false,
                        onToggleReferences = {},
                        onOpenRelated = { openedProfiles.incrementAndGet() },
                        api = api,
                        session = session,
                    )
                }
            }
        }

        compose.onNodeWithTag("profileContact-anonymous-contact").performClick()
        compose.onNodeWithText("Unnamed Author").performClick()

        org.junit.Assert.assertEquals("Entries without usernames have no profile destination", 0, openedProfiles.get())
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
