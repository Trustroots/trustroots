package org.trustroots.android.ui.menu

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.ui.common.SharedNavigationLinks
import org.trustroots.android.ui.common.horizontalInset
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
    openBrowser: (BrowserRoute) -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val buildDate = rememberBuildDate()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding(), bottom = contentPadding.calculateBottomPadding())
            .padding(contentPadding.horizontalInset())
            .verticalScroll(rememberScrollState())
            .padding(top = 12.dp),
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
                "@${session.member.username}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                "View your profile",
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        MenuLink("Edit profile", Icons.Default.Edit, openEditProfile)
        MenuLink("Host", Icons.Default.Home, openHost)
        MenuLink("Nostroots", Icons.Default.Public, openNostroots)
        MenuLink("Contacts", Icons.Default.People, openContacts)
        MenuLink("Find people", Icons.Default.PersonSearch, openFindPeople)
        MenuLink("Circles", Icons.Default.Groups, openCircles)
        MenuLink("Account", Icons.Default.Settings, openAccount)
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(
            SharedNavigationLinks.INFO_AND_SUPPORT_HEADING,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        )
        SharedNavigationLinks.INFO_AND_SUPPORT.forEach { link ->
            MenuLink(link.label, infoAndSupportIcon(link.id)) {
                openBrowser(BrowserRoute(link.label, link.url))
            }
        }
        Spacer(Modifier.height(24.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.primaryContainer)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = "Trustroots",
                modifier = Modifier.size(72.dp),
            )
            Text("Travellers’ community", color = MaterialTheme.colorScheme.primary)
            Text(
                "API: ${BuildConfig.API_BASE_URL}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp),
            )
            Text(
                "Build: $buildDate",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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
