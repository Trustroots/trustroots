package org.trustroots.android.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.foundation.clickable
import androidx.compose.ui.semantics.Role
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient

@Composable
internal fun MemberIdentity(
    api: MobileApiClient,
    session: MemberSession,
    member: MessageMember,
    modifier: Modifier = Modifier,
    nameFontWeight: FontWeight = FontWeight.Bold,
    onClick: (() -> Unit)? = null,
    avatarSize: androidx.compose.ui.unit.Dp = 48.dp,
) {
    val name = nonBlankMemberText(member.displayName.trim())
    val username = nonBlankMemberText(member.username?.trim())
    val handle = username?.let {
        stringResource(R.string.screen_username_handle, it)
    }
    Row(
        modifier = modifier.then(
            if (onClick == null) Modifier else Modifier.clickable(role = Role.Button, onClick = onClick),
        ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (avatarSize == 36.dp) 8.dp else 10.dp),
    ) {
        RemoteArtwork(
            url = member.id?.let { api.avatarURL(it, 64, session) },
            sessionCookie = session.cookieHeader,
            accessToken = session.accessToken,
            label = name ?: username ?: "?",
            size = avatarSize,
        )
        Column(Modifier.weight(1f)) {
            Text(
                name ?: handle ?: stringResource(R.string.profile_photo_default_member_label),
                fontWeight = nameFontWeight,
            )
            if (name != null && handle != null) {
                Text(handle, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
