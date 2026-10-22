package org.trustroots.android.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R

@Composable
internal fun hostGuestCountLabel(count: Int): String =
    pluralStringResource(R.plurals.screen_host_result_guest_count, count, count)

@Composable
internal fun mapOfferCountLabel(count: Int): String =
    pluralStringResource(R.plurals.screen_offers_count, count, count)

@Composable
internal fun mapCommunityNoteCountLabel(count: Int): String =
    pluralStringResource(R.plurals.screen_community_notes_count, count, count)

@Composable
internal fun mapNostrootsNoteCountLabel(count: Int): String =
    pluralStringResource(R.plurals.screen_nostroots_notes_count, count, count)

@Composable
internal fun mapStatisticsLabel(offers: Int, communityNotes: Int): String =
    stringResource(
        R.string.screen_map_statistics,
        mapOfferCountLabel(offers),
        mapNostrootsNoteCountLabel(communityNotes),
    )
