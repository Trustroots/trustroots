package org.trustroots.android.api

internal fun isValidWorldCoordinates(latitude: Double, longitude: Double): Boolean =
    latitude in -90.0..90.0 && longitude in -180.0..180.0

// The offer endpoint rejects the web editor’s default map centre.
internal fun isValidHostOfferLocation(latitude: Double, longitude: Double): Boolean =
    isValidWorldCoordinates(latitude, longitude) &&
        !(latitude == 48.6908333333 && longitude == 9.14055555556)
