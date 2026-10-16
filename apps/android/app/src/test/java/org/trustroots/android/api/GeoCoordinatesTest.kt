package org.trustroots.android.api

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GeoCoordinatesTest {
    @Test fun acceptsInclusiveWorldBoundsAndInteriorPoints() {
        for (latitude in listOf(-90.0, 0.0, 90.0)) {
            for (longitude in listOf(-180.0, 0.0, 180.0)) {
                assertTrue("$latitude, $longitude", isValidWorldCoordinates(latitude, longitude))
            }
        }
    }

    @Test fun rejectsPointsImmediatelyOutsideEachBoundary() {
        for (latitude in listOf(Math.nextDown(-90.0), Math.nextUp(90.0))) {
            assertFalse("latitude $latitude", isValidWorldCoordinates(latitude, 0.0))
        }
        for (longitude in listOf(Math.nextDown(-180.0), Math.nextUp(180.0))) {
            assertFalse("longitude $longitude", isValidWorldCoordinates(0.0, longitude))
        }
    }

    @Test fun rejectsNonFiniteValuesInEitherCoordinate() {
        for (invalid in listOf(Double.NaN, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY)) {
            assertFalse("latitude $invalid", isValidWorldCoordinates(invalid, 0.0))
            assertFalse("longitude $invalid", isValidWorldCoordinates(0.0, invalid))
        }
    }
}
