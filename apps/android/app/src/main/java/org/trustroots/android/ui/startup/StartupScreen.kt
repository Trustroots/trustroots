package org.trustroots.android.ui.startup

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.ui.common.rememberBuildDate

@Composable
internal fun StartupScreen(firstName: String?) {
    val buildDate = rememberBuildDate()
    val brandName = stringResource(R.string.screen_brand_name)
    val communityTagline = stringResource(R.string.screen_travellers_community)
    val buildLabel = stringResource(R.string.screen_build_date, buildDate)
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.primaryContainer).safeDrawingPadding()) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = brandName,
                modifier = Modifier.size(180.dp),
            )
            Text(communityTagline, style = MaterialTheme.typography.titleMedium)
            if (!firstName.isNullOrBlank()) {
                Text(
                    stringResource(R.string.screen_welcome_name, firstName),
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(top = 24.dp),
                )
            }
        }
        Text(
            buildLabel,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp),
        )
    }
}
