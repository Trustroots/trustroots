package org.trustroots.android.ui

import android.location.Address
import android.location.Geocoder
import java.util.Locale
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE, shadows = [SynchronousNameGeocoderShadow::class])
class AndroidGeocoderAdapterTest {
    @Before fun resetShadow() = SynchronousNameGeocoderShadow.reset()

    @After fun clearShadow() = SynchronousNameGeocoderShadow.reset()

    @Test fun passesQueryAndLimitToAndroidGeocoderAndReturnsItsPlaces() {
        val fictionalAddress = Address(Locale.UK).apply {
            latitude = 51.5
            longitude = -0.12
            setAddressLine(0, "Fictional Harbour")
        }
        SynchronousNameGeocoderShadow.results = mutableListOf(fictionalAddress)

        val result = lookupAndroidPlaces(
            RuntimeEnvironment.getApplication(),
            "Fictional Harbour",
            3,
        )

        assertEquals("Fictional Harbour", SynchronousNameGeocoderShadow.lastQuery)
        assertEquals(3, SynchronousNameGeocoderShadow.lastMaxResults)
        assertEquals(1, result?.size)
        assertSame(fictionalAddress, result?.single())
    }
}

@Implements(Geocoder::class)
class SynchronousNameGeocoderShadow {
    @Implementation
    fun getFromLocationName(locationName: String, maxResults: Int): MutableList<Address>? {
        lastQuery = locationName
        lastMaxResults = maxResults
        return results
    }

    companion object {
        var results: MutableList<Address> = mutableListOf()
        var lastQuery: String? = null
        var lastMaxResults: Int? = null

        fun reset() {
            results = mutableListOf()
            lastQuery = null
            lastMaxResults = null
        }
    }
}
