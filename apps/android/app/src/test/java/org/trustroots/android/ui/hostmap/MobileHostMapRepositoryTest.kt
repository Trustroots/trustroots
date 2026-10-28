package org.trustroots.android.ui.hostmap

import android.content.Context
import android.location.Address
import java.io.IOException
import java.util.Locale
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MobileHostMapRepositoryTest {
    private val session = MemberSession("", MobileMember("fictional-member", "Fictional Member"))

    @Test
    fun defaultGeocoderRepositoryRecognisesCredentialAndAccountChanges() {
        val repository = MobileHostMapRepository(
            api = MobileApiClient("https://api.example.test"),
            session = session,
            applicationContext = org.robolectric.RuntimeEnvironment.getApplication(),
        )
        val refreshedCredentials = session.copy(cookieHeader = "fictional-refreshed-cookie")
        val switchedAccount = refreshedCredentials.copy(member = MobileMember("second-member", "Second Member"))

        assertFalse(repository.updateSession(session))
        assertTrue(repository.updateSession(refreshedCredentials))
        assertFalse(repository.updateSession(refreshedCredentials))
        assertTrue(repository.updateSession(switchedAccount))
    }

    @Test
    fun placesDropsAddressesWithoutUsableLabelsOrFiniteCoordinates() = runBlocking {
        val repository = repository { _, _, _ ->
            listOf(
                address(label = "Fictional Place", latitude = 12.5, longitude = -34.5),
                address(label = null, latitude = 1.0, longitude = 2.0),
                address(label = "   ", latitude = 1.0, longitude = 2.0),
                address(label = "Invalid latitude", latitude = Double.NaN, longitude = 2.0),
                address(label = "Invalid longitude", latitude = 1.0, longitude = Double.POSITIVE_INFINITY),
            )
        }

        val result = repository.places("Fictional Place", 3)

        assertEquals(
            listOf(PlaceSuggestion("Fictional Place", 12.5, -34.5)),
            result.getOrThrow(),
        )
    }

    @Test
    fun nullGeocoderResultBecomesAnEmptySuccessfulResult() = runBlocking {
        val repository = repository { _, _, _ -> null }

        val result = repository.places("Fictional Place", 3)

        assertTrue(result.isSuccess)
        assertEquals(emptyList<PlaceSuggestion>(), result.getOrThrow())
    }

    @Test
    fun thrownGeocoderFailureIsReturnedAsFailure() = runBlocking {
        val expected = IOException("Fictional geocoder failure")
        val repository = repository { _, _, _ -> throw expected }

        val result = repository.places("Fictional Place", 3)

        assertFalse(result.isSuccess)
        assertTrue(result.exceptionOrNull() === expected)
    }

    private fun repository(
        lookup: (Context, String, Int) -> List<Address>?,
    ) = MobileHostMapRepository(
        api = MobileApiClient("https://api.example.test/"),
        session = session,
        applicationContext = org.robolectric.RuntimeEnvironment.getApplication(),
        geocoderLookup = lookup,
    )

    private fun address(label: String?, latitude: Double, longitude: Double) =
        Address(Locale.ROOT).apply {
            label?.let { setAddressLine(0, it) }
            this.latitude = latitude
            this.longitude = longitude
        }
}
