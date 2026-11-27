package org.trustroots.shared.ui

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeUIViewController

@OptIn(ExperimentalComposeUiApi::class)
fun MemberSearchViewController(
    state: MemberSearchState,
    request: (String, PilotMemberSearchFilters, (List<PilotSearchMember>?, String?) -> Unit) -> Unit,
    loadCircles: ((List<PilotSearchCircle>?, String?) -> Unit) -> Unit,
    onProfile: (String) -> Unit,
) = ComposeUIViewController(configure = { opaque = false }) {
    MemberSearchScreen(state, request, loadCircles, onProfile)
}
