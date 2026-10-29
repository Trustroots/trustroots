package org.trustroots.android.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import org.trustroots.android.api.ConversationRecipient
import org.trustroots.android.api.MessageMember

@Composable
internal fun MessageMember.localizedLabel(): String = localizedLabel(displayName, username)

@Composable
internal fun ConversationRecipient.localizedLabel(): String = localizedLabel(displayName, username)

@Composable
private fun localizedLabel(displayName: String?, username: String?): String =
    nonBlankMemberText(displayName)
        ?: nonBlankMemberText(username)
        ?: stringResource(R.string.profile_photo_default_member_label)
