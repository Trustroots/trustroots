package org.trustroots.android.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import org.trustroots.android.api.MessageMember

@Composable
internal fun MessageMember.localizedLabel(): String =
    displayName.takeIf(String::isNotBlank)
        ?: username?.takeIf(String::isNotBlank)
        ?: stringResource(R.string.profile_photo_default_member_label)
