package org.trustroots.android.ui.search

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable as KotlinSerializable

/** Stable anchor for one Search tab visit; its ViewModels live above child routes. */
@KotlinSerializable
internal data class SearchHomeVisit(val visitID: Long) : NavKey

@KotlinSerializable
internal enum class SearchMode { Map, Members }

/** The visible Search mode is a route, while both mode ViewModels belong to SearchHomeVisit. */
@KotlinSerializable
internal data class SearchModeVisit(val mode: SearchMode, val visitID: Long) : NavKey

@KotlinSerializable
internal enum class SearchOfferType { Host, Meet }

/** A detail entry reloads canonical content from its public offer ID. */
@KotlinSerializable
internal data class HostDetailVisit(
    val offerID: String,
    val offerType: SearchOfferType,
    val visitID: Long,
) : NavKey

/** A profile opened from member results or a host result within this Search visit. */
@KotlinSerializable
internal data class SearchMemberProfileVisit(val username: String, val visitID: Long) : NavKey
