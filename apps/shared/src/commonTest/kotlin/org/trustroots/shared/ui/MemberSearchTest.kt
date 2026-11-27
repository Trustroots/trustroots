package org.trustroots.shared.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MemberSearchTest {
    @Test fun initialStateHasNoSearchResultsOrError() {
        val state = MemberSearchState()
        assertEquals("", state.query)
        assertTrue(state.results.isEmpty())
        assertFalse(state.isLoading)
        assertFalse(state.hasSearched)
        assertEquals(null, state.error)
    }

    @Test fun searchShowsLoadingThenPopulatedResults() {
        val state = MemberSearchState()
        state.updateQuery("  forest friend  ")
        var completion: ((List<PilotSearchMember>?, String?) -> Unit)? = null
        var requestedQuery = ""
        state.search({ query, _, done -> requestedQuery = query; completion = done })

        assertEquals("forest friend", requestedQuery)
        assertTrue(state.isLoading)
        assertTrue(state.hasSearched)
        completion?.invoke(listOf(PilotSearchMember("id", "forest-friend", "Forest Friend", "Lisbon")), null)

        assertFalse(state.isLoading)
        assertEquals("Forest Friend", state.results.single().displayName)
        assertEquals(null, state.error)
    }

    @Test fun emptyResponseShowsCompletedEmptyState() {
        val state = MemberSearchState()
        state.updateQuery("unknown person")
        state.search({ _, _, done -> done(emptyList(), null) })

        assertTrue(state.hasSearched)
        assertFalse(state.isLoading)
        assertTrue(state.results.isEmpty())
        assertEquals(null, state.error)
    }

    @Test fun failureCanRetryTheSameQueryAndFilters() {
        val state = MemberSearchState()
        state.updateQuery("forest friend")
        val selected = PilotMemberSearchFilters(hosts = true)
        state.updateFilters(selected)
        state.search({ _, _, done -> done(null, "Service unavailable") })
        assertEquals("Service unavailable", state.error)

        var retryQuery = ""
        var retryFilters = PilotMemberSearchFilters()
        state.retry { query, filters, done ->
            retryQuery = query
            retryFilters = filters
            done(listOf(PilotSearchMember(null, "forest-friend", "Forest Friend", null)), null)
        }

        assertEquals("forest friend", retryQuery)
        assertEquals(selected, retryFilters)
        assertEquals(1, state.results.size)
        assertEquals(null, state.error)
    }

    @Test fun changedFiltersRefreshTheLastCompletedQuery() {
        val state = MemberSearchState()
        state.updateQuery("forest friend")
        state.search({ _, _, done -> done(emptyList(), null) })
        val updated = PilotMemberSearchFilters(connectionsOnly = true, circleIDs = listOf("circle-1"))
        state.updateFilters(updated)
        var refreshedQuery = ""
        var refreshedFilters = PilotMemberSearchFilters()
        state.refreshIfFiltersChanged { query, filters, done ->
            refreshedQuery = query
            refreshedFilters = filters
            done(emptyList(), null)
        }

        assertEquals("forest friend", refreshedQuery)
        assertEquals(updated, refreshedFilters)
    }

    @Test fun shortQueriesAreNotSubmitted() {
        val state = MemberSearchState()
        state.updateQuery("ab")
        var called = false
        state.search { _, _, _ -> called = true }
        assertFalse(called)
        assertFalse(state.isLoading)
    }

    @Test fun responseForAnOlderQueryDoesNotReplaceCurrentResults() {
        val state = MemberSearchState()
        state.updateQuery("first query")
        var staleCompletion: ((List<PilotSearchMember>?, String?) -> Unit)? = null
        state.search({ _, _, done -> staleCompletion = done })
        state.updateQuery("second query")
        staleCompletion?.invoke(listOf(PilotSearchMember(null, "old", "Old result", null)), null)

        assertEquals("second query", state.query)
        assertTrue(state.results.isEmpty())
        assertFalse(state.isLoading)
    }
}
