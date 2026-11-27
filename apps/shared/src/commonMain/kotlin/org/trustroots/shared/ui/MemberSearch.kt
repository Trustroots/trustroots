package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

data class PilotMemberSearchFilters(
    val hosts: Boolean = false,
    val meetings: Boolean = false,
    val volunteering: Boolean = false,
    val connectionsOnly: Boolean = false,
    val onlineRecently: Boolean = false,
    val circleIDs: List<String> = emptyList(),
    val languages: List<String> = emptyList(),
)

data class PilotSearchCircle(val id: String, val label: String)
data class PilotSearchLanguage(val code: String, val label: String)
data class PilotSearchMember(
    val id: String?,
    val username: String,
    val displayName: String,
    val location: String?,
)

class MemberSearchState {
    var query by mutableStateOf("")
        private set
    var filters by mutableStateOf(PilotMemberSearchFilters())
        private set
    var results by mutableStateOf<List<PilotSearchMember>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var hasSearched by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var circles by mutableStateOf<List<PilotSearchCircle>>(emptyList())
        private set
    var languages by mutableStateOf<List<PilotSearchLanguage>>(emptyList())
        private set
    private var submittedQuery = ""
    private var submittedFilters = PilotMemberSearchFilters()
    private var generation = 0

    fun updateQuery(value: String) {
        generation += 1
        isLoading = false
        query = value.take(120)
        hasSearched = false
        error = null
    }

    fun clearQuery() {
        updateQuery("")
        results = emptyList()
    }

    fun updateFilters(value: PilotMemberSearchFilters) { filters = value }
    fun updateCircles(value: List<PilotSearchCircle>) { circles = value }
    fun updateLanguages(value: List<PilotSearchLanguage>) { languages = value }

    fun search(
        request: (String, PilotMemberSearchFilters, (List<PilotSearchMember>?, String?) -> Unit) -> Unit,
        value: String = query,
        selectedFilters: PilotMemberSearchFilters = filters,
    ) {
        val cleanQuery = value.trim()
        if (cleanQuery.length < 3 || isLoading) return
        val requestGeneration = ++generation
        submittedQuery = cleanQuery
        submittedFilters = selectedFilters
        isLoading = true
        hasSearched = true
        error = null
        request(cleanQuery, selectedFilters) { matches, failure ->
            if (requestGeneration != generation) return@request
            isLoading = false
            if (failure != null) {
                results = emptyList()
                error = failure
            } else {
                results = matches.orEmpty()
                if (query.trim() == cleanQuery && filters != selectedFilters) {
                    search(request, cleanQuery, filters)
                }
            }
        }
    }

    fun retry(request: (String, PilotMemberSearchFilters, (List<PilotSearchMember>?, String?) -> Unit) -> Unit) {
        search(request, submittedQuery, submittedFilters)
    }

    fun refreshIfFiltersChanged(
        request: (String, PilotMemberSearchFilters, (List<PilotSearchMember>?, String?) -> Unit) -> Unit,
    ) {
        if (hasSearched && filters != submittedFilters) search(request, submittedQuery, filters)
    }
}

@Composable
fun MemberSearchScreen(
    state: MemberSearchState,
    request: (String, PilotMemberSearchFilters, (List<PilotSearchMember>?, String?) -> Unit) -> Unit,
    loadCircles: ((List<PilotSearchCircle>?, String?) -> Unit) -> Unit,
    onProfile: (String) -> Unit,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    var showFilters by androidx.compose.runtime.remember { mutableStateOf(false) }
    var languageQuery by androidx.compose.runtime.remember { mutableStateOf("") }
    androidx.compose.runtime.LaunchedEffect(state) {
        if (state.circles.isEmpty()) loadCircles { values, _ -> state.updateCircles(values.orEmpty()) }
    }
    Column(Modifier.fillMaxSize().background(pilotPalette.background)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.End) {
            PilotButton("Member filters", enabled = !state.isLoading, modifier = Modifier.testTag("member-search-filters")) {
                focus.clearFocus()
                keyboard?.hide()
                showFilters = true
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            when {
                state.isLoading -> PilotText("Finding members…", Modifier.semantics { contentDescription = "Loading member search" })
                state.error != null -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PilotTitle("Member search unavailable")
                    PilotText(state.error ?: "Please try again.")
                    PilotButton("Try again", modifier = Modifier.testTag("member-search-retry")) { state.retry(request) }
                }
                state.hasSearched && state.results.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    PilotTitle("No members found")
                    PilotText("Try a different search or change your filters.")
                }
                state.results.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    PilotTitle("Find members")
                    PilotText("Search by name, username, location or tagline.")
                }
                else -> Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                    state.results.forEach { member ->
                        Column(
                            Modifier.fillMaxWidth().testTag("member-search-result-${member.username}")
                                .clickable(role = Role.Button) { onProfile(member.username) }
                                .semantics { contentDescription = "Open profile for ${member.displayName}, ${member.username}" }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            PilotText(member.displayName, strong = true)
                            PilotText("@${member.username}", colour = pilotPalette.accent)
                            member.location?.let { PilotText(it) }
                        }
                    }
                }
            }
        }
        Column(Modifier.fillMaxWidth().background(pilotPalette.surface).padding(horizontal = 12.dp, vertical = 8.dp)) {
            PilotInput(
                label = "Name, username, location or tagline",
                value = state.query,
                tag = "member-search-field",
                enabled = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = {
                    keyboard?.hide(); focus.clearFocus(); state.search(request)
                }),
                onChange = state::updateQuery,
            )
            if (state.query.trim().isNotEmpty() && state.query.trim().length < 3) {
                PilotText("Enter at least 3 characters.")
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (state.query.isNotEmpty()) {
                    PilotButton(
                        "Clear",
                        modifier = Modifier.testTag("member-search-clear")
                            .semantics { contentDescription = "Clear member search" },
                    ) { state.clearQuery() }
                }
                PilotButton("Done", modifier = Modifier.testTag("member-search-keyboard-done")) { keyboard?.hide(); focus.clearFocus() }
                PilotButton("Search members", enabled = state.query.trim().length >= 3 && !state.isLoading, modifier = Modifier.testTag("member-search-submit")) {
                    keyboard?.hide(); focus.clearFocus(); state.search(request)
                }
            }
        }
    }
    if (showFilters) {
        Dialog(onDismissRequest = {
            showFilters = false
            state.refreshIfFiltersChanged(request)
        }) {
            Column(Modifier.fillMaxWidth().background(pilotPalette.background).verticalScroll(rememberScrollState()).padding(18.dp)) {
                PilotTitle("Member filters")
                FilterToggle("Hosts", state.filters.hosts) { state.updateFilters(state.filters.copy(hosts = it)) }
                FilterToggle("Meetings", state.filters.meetings) { state.updateFilters(state.filters.copy(meetings = it)) }
                FilterToggle("Offers volunteering", state.filters.volunteering) { state.updateFilters(state.filters.copy(volunteering = it)) }
                FilterToggle("My connections only", state.filters.connectionsOnly) { state.updateFilters(state.filters.copy(connectionsOnly = it)) }
                FilterToggle("Online in the past 6 months", state.filters.onlineRecently) { state.updateFilters(state.filters.copy(onlineRecently = it)) }
                PilotText("Circles", strong = true)
                state.circles.forEach { circle -> FilterToggle(circle.label, circle.id in state.filters.circleIDs) { enabled ->
                    val ids = state.filters.circleIDs.toMutableSet().apply { if (enabled) add(circle.id) else remove(circle.id) }
                    state.updateFilters(state.filters.copy(circleIDs = ids.sorted()))
                } }
                PilotText("Spoken languages", strong = true)
                PilotInput("Search languages", languageQuery, "member-search-languages", true, onChange = { languageQuery = it })
                val selectedLanguages = state.languages.filter { it.code in state.filters.languages }
                val languageChoices = if (languageQuery.isBlank()) {
                    (selectedLanguages + state.languages.filter { it.code in COMMON_SEARCH_LANGUAGES })
                        .distinctBy { it.code }
                } else {
                    state.languages.filter {
                        it.code.contains(languageQuery, ignoreCase = true) ||
                            it.label.contains(languageQuery, ignoreCase = true)
                    }.take(30)
                }
                languageChoices.forEach { language ->
                    FilterToggle(language.label, language.code in state.filters.languages) { enabled ->
                        val selected = state.filters.languages.toMutableSet()
                            .apply { if (enabled) add(language.code) else remove(language.code) }
                        state.updateFilters(state.filters.copy(languages = selected.sorted()))
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    PilotButton("Reset") { state.updateFilters(PilotMemberSearchFilters()) }
                    PilotButton("Done", modifier = Modifier.testTag("member-search-filters-done")) {
                        showFilters = false
                        state.refreshIfFiltersChanged(request)
                    }
                }
            }
        }
    }
}

private val COMMON_SEARCH_LANGUAGES = setOf("eng", "por", "spa", "fre", "ger", "ita", "dut", "rus", "pol", "tur", "ara", "jpn", "glg")

@Composable
private fun FilterToggle(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().testTag("member-search-filter-${label.lowercase().replace(' ', '-')}")
            .clickable(role = Role.Switch) { onChange(!checked) }
            .semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PilotText(if (checked) "☑  $label" else "☐  $label", Modifier.padding(vertical = 8.dp))
    }
}
