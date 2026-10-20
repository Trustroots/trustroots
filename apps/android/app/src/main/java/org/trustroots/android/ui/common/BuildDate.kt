package org.trustroots.android.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.trustroots.android.BuildConfig

@Composable
internal fun rememberBuildDate(): String {
    return remember {
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT)
            .format(Date(BuildConfig.BUILD_EPOCH_SECONDS * 1_000))
    }
}
