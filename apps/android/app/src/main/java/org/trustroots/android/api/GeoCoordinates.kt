package org.trustroots.android.api

internal fun isValidWorldCoordinates(latitude: Double, longitude: Double): Boolean =
    latitude in -90.0..90.0 && longitude in -180.0..180.0
