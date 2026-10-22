@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.menu

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Public
import androidx.compose.foundation.clickable
import androidx.compose.material3.Icon
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.ui.common.MemberLargeTopAppBar
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.SharedNavigationLink
import org.trustroots.android.ui.common.SharedNavigationLinks
import org.trustroots.android.ui.common.rememberBuildDate

@Composable
internal fun MenuScreen(
    session: MemberSession,
    openProfile: () -> Unit,
    openEditProfile: () -> Unit,
    openHost: () -> Unit,
    openNostroots: () -> Unit,
    openContacts: () -> Unit,
    openFindPeople: () -> Unit,
    openCircles: () -> Unit,
    openAccount: () -> Unit,
    openBrowser: (SharedNavigationLink) -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val buildDate = rememberBuildDate()
    val uiLocale = androidx.compose.ui.platform.LocalConfiguration.current.locales[0]
    val usernameHandleFormat = stringResource(R.string.screen_username_handle)
    val viewYourProfile = stringResource(R.string.screen_view_your_profile)
    val editProfile = stringResource(R.string.screen_edit_profile)
    val host = stringResource(R.string.screen_host)
    val nostroots = stringResource(R.string.screen_nostroots)
    val contacts = stringResource(R.string.screen_contacts)
    val findPeople = stringResource(R.string.screen_find_people)
    val circles = stringResource(R.string.screen_destination_circles)
    val account = stringResource(R.string.screen_account)
    val brandName = stringResource(R.string.screen_brand_name)
    val communityTagline = stringResource(R.string.screen_travellers_community)
    val apiLabel = stringResource(R.string.screen_api_url, BuildConfig.API_BASE_URL)
    val buildLabel = stringResource(R.string.screen_build_date, buildDate)
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        modifier = Modifier.fillMaxSize().nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            MemberLargeTopAppBar(
                title = stringResource(R.string.screen_destination_profile),
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
            )
        },
    ) { appBarPadding ->
    Column(
        modifier = Modifier.fillMaxSize()
            .padding(top = appBarPadding.calculateTopPadding())
            .verticalScroll(rememberScrollState())
            .padding(contentPadding.horizontalInset())
            .padding(top = 12.dp)
            .testTag("profileDestinationScreen"),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = openProfile)
                .padding(horizontal = 20.dp, vertical = 4.dp),
        ) {
            Text(
                session.member.displayName,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                String.format(uiLocale, usernameHandleFormat, session.member.username),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                viewYourProfile,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        MenuLink(editProfile, Icons.Default.Edit, openEditProfile)
        MenuLink(host, Icons.Default.Home, openHost)
        MenuLink(nostroots, Icons.Default.Public, openNostroots)
        MenuLink(contacts, Icons.Default.People, openContacts)
        MenuLink(findPeople, Icons.Default.PersonSearch, openFindPeople)
        MenuLink(circles, Icons.Default.Groups, openCircles)
        MenuLink(account, Icons.Default.Settings, openAccount)
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(
            stringResource(R.string.screen_info_and_support),
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        )
        SharedNavigationLinks.INFO_AND_SUPPORT.forEach { link ->
            MenuLink(stringResource(supportLinkLabelResource(link.id)), infoAndSupportIcon(link.id)) {
                openBrowser(link)
            }
        }
        Spacer(Modifier.height(contentPadding.calculateBottomPadding() + 24.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.primaryContainer)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = brandName,
                modifier = Modifier.size(72.dp),
            )
            Text(communityTagline, color = MaterialTheme.colorScheme.primary)
            Text(
                apiLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp),
            )
            Text(
                buildLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
    }
}

private fun infoAndSupportIcon(id: String) =
    if (id == "contact" || id == "faq") {
        Icons.AutoMirrored.Filled.HelpOutline
    } else {
        Icons.Default.Info
    }

@Composable
private fun MenuLink(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    TextButton(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp),
    ) {
        Icon(icon, contentDescription = null)
        Text(
            label,
            modifier = Modifier
                .weight(1f)
                .padding(start = 14.dp),
            color = MaterialTheme.colorScheme.primary,
        )
    }
}
