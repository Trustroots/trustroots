@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.common

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.trustroots.android.R

/** Large title app bar shared by native member screens with scrollable content. */
@Composable
internal fun PinnedTopAppBar(
    title: String,
    scrollBehavior: TopAppBarScrollBehavior,
    contentPadding: PaddingValues,
    onBack: (() -> Unit)? = null,
    leadingContent: (@Composable () -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    TopAppBar(
        title = {
            Text(
                title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("memberLargeTopAppBarTitle"),
            )
        },
        modifier = Modifier.padding(contentPadding.horizontalInset()).testTag("memberLargeTopAppBar"),
        windowInsets = WindowInsets(
            left = 0.dp,
            top = contentPadding.calculateTopPadding(),
            right = 0.dp,
            bottom = 0.dp,
        ),
        navigationIcon = {
            if (onBack != null || leadingContent != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (onBack != null) {
                        IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.back),
                            )
                        }
                    }
                    leadingContent?.invoke()
                }
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        scrollBehavior = scrollBehavior,
    )
}
