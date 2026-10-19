package org.trustroots.android.ui

import androidx.activity.compose.BackHandler
import android.text.Html
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import org.trustroots.android.ui.common.LiveFilterField
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.bottomInset
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.ArtworkHero

@Composable
internal fun CirclesScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    var circles by remember { mutableStateOf<List<TrustrootsCircle>>(emptyList()) }
    var memberships by remember { mutableStateOf<Set<String>>(emptySet()) }
    var filter by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<TrustrootsCircle?>(null) }
    var updating by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    BackHandler(enabled = selected != null) { selected = null }
    LaunchedEffect(session) {
        loading = true
        api.circles(session).onSuccess { circles = it }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else error = it.messageOr("Could not load circles.")
        }
        api.circleMemberships(session).onSuccess { memberships = it }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else error = it.messageOr("Could not load circle memberships.")
        }
        loading = false
    }
    val toggle: (TrustrootsCircle) -> Unit = { circle ->
        if (updating == null) {
            scope.launch {
                updating = circle.id
                error = null
                val joined = circle.id in memberships
                api.setCircleMembership(session, circle.id, joined).onSuccess {
                    memberships = if (joined) memberships - circle.id else memberships + circle.id
                }.onFailure {
                    if (it.isAuthenticationFailure()) onSessionInvalidated()
                    else error = it.messageOr("Could not update membership.")
                }
                updating = null
            }
        }
    }
    selected?.let { circle ->
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Box {
            ArtworkHero(
                url = if (circle.image) api.circleHeroURL(circle.slug) else null,
                sessionCookie = null,
                label = circle.label,
                subtitle = "${circle.count} members",
                background = circleColor(circle.color),
                blurBackground = false,
                testTag = "circleHero",
            )
            NativeBackButton(
                onBack = { selected = null },
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(contentPadding.horizontalInset())
                    .padding(top = contentPadding.calculateTopPadding() + 8.dp, bottom = 8.dp, start = 8.dp, end = 8.dp),
                tint = Color.White,
            )
            }
            Column(Modifier.padding(20.dp).padding(contentPadding.horizontalInset()).padding(contentPadding.bottomInset())) {
            circle.description?.let {
                Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), modifier = Modifier.padding(vertical = 16.dp))
            }
            Button(onClick = { toggle(circle) }, enabled = updating == null) {
                Text(if (circle.id in memberships) "Leave circle" else "Join circle")
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        }
        return
    }
    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding(), bottom = 20.dp)) {
        Column(Modifier.padding(horizontal = 20.dp).padding(contentPadding.horizontalInset())) {
        Text("Discover circles", style = MaterialTheme.typography.headlineMedium)
        Text("Joining circles helps you find likeminded Trustroots members.", modifier = Modifier.padding(vertical = 8.dp))
        LiveFilterField(
            value = filter,
            onValueChange = { filter = it },
            label = stringResource(R.string.filter_circles),
            clearLabel = stringResource(R.string.clear_circle_filter),
        )
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
        val visibleCircles = remember(circles, filter) {
            circles.filter { circle ->
                val description = circle.description?.let {
                    Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString()
                }.orEmpty()
                "${circle.label} $description".contains(filter.trim(), ignoreCase = true)
            }.sortedWith(compareByDescending<TrustrootsCircle> { it.count }.thenBy { it.label })
        }
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding()),
        ) {
            items(visibleCircles, key = { it.id }) { circle ->
                Row(Modifier.fillMaxWidth().clickable { selected = circle }.padding(horizontal = 16.dp, vertical = 9.dp).padding(contentPadding.horizontalInset())) {
                    RemoteArtwork(
                        url = if (circle.image) api.circleImageURL(circle.slug) else null,
                        sessionCookie = null,
                        label = circle.label,
                        size = 54.dp,
                        background = circleColor(circle.color),
                    )
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(circle.label, fontWeight = FontWeight.Bold)
                        Text("${circle.count} members")
                    }
                    if (circle.id in memberships) {
                        OutlinedButton(onClick = { toggle(circle) }, enabled = updating == null) {
                            Icon(Icons.Default.Check, contentDescription = null)
                            Text("Joined")
                        }
                    } else {
                        Button(onClick = { toggle(circle) }, enabled = updating == null) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Text("Join")
                        }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

private fun circleColor(value: String?): Color =
    runCatching { Color(android.graphics.Color.parseColor("#$value")) }
        .getOrDefault(Color(0xFF12B591))
