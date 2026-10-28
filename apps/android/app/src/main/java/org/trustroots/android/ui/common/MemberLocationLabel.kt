package org.trustroots.android.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R

@Composable
internal fun memberLocationLabel(locationLiving: String?, locationFrom: String?): String? =
    nonBlankMemberText(locationLiving)
        ?: nonBlankMemberText(locationFrom)?.let {
            stringResource(R.string.member_location_from, it)
        }
