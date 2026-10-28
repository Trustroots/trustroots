package org.trustroots.android.ui

import android.content.Context
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.R
import org.trustroots.android.api.MessageMember
import org.trustroots.android.ui.common.localizedLabel

@RunWith(AndroidJUnit4::class)
class MemberLabelJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun choosesDisplayNameThenUsernameThenTheLocalisedFallback() {
        lateinit var replaceMember: (MessageMember) -> Unit
        compose.setContent {
            MaterialTheme {
                var member by remember {
                    mutableStateOf(MessageMember("member-id", "fictional-member", "Fictional Member"))
                }
                replaceMember = { member = it }
                Text(member.localizedLabel())
            }
        }

        compose.onNodeWithText("Fictional Member").assertIsDisplayed()
        compose.runOnIdle { replaceMember(MessageMember("member-id", "fictional-member", "  ")) }
        compose.onNodeWithText("fictional-member").assertIsDisplayed()

        compose.runOnIdle { replaceMember(MessageMember(null, null, "")) }
        val fallback = ApplicationProvider.getApplicationContext<Context>()
            .getString(R.string.profile_photo_default_member_label)
        compose.onNodeWithText(fallback).assertIsDisplayed()
    }
}
