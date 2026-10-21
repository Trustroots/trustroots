package org.trustroots.android.ui.circles

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

/** The genuine overview owner beneath one top-level Circles visit. */
@Serializable
internal data class CircleOverviewVisit(val visitID: Long) : NavKey

/** A detail destination reloads its canonical circle from the public slug. */
@Serializable
internal data class CircleDetailVisit(val slug: String, val visitID: Long) : NavKey
