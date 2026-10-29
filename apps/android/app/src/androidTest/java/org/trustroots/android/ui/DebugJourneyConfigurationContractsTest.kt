package org.trustroots.android.ui

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.HostOfferUpdate
import org.trustroots.android.ui.hostoffer.HostOfferForm
import org.trustroots.android.ui.hostoffer.HostOfferRepository

@RunWith(AndroidJUnit4::class)
class DebugJourneyConfigurationContractsTest {
    @Test
    fun signInJourneyRequiresItsApiBaseUrlAndReturnsTheConfiguredValue() {
        assertThrows(IllegalArgumentException::class.java) {
            Intent().requireJourneyApiBaseUrl()
        }

        assertEquals(
            "https://api.example.test/",
            Intent()
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, "https://api.example.test/")
                .requireJourneyApiBaseUrl(),
        )
    }

    @Test
    fun hostOfferJourneyRequiresItsRepositoryAndReturnsTheConfiguredInstance() {
        val previousRepository = HostOfferNav3JourneyProvider.repository
        val repository = object : HostOfferRepository {
            override suspend fun load(): Result<HostOfferForm> = Result.success(HostOfferForm())

            override suspend fun save(update: HostOfferUpdate): Result<AccommodationOffer> =
                Result.failure(UnsupportedOperationException("This contract test does not save offers."))
        }

        try {
            HostOfferNav3JourneyProvider.repository = null
            assertThrows(IllegalArgumentException::class.java) {
                HostOfferNav3JourneyProvider.requireRepository()
            }

            HostOfferNav3JourneyProvider.repository = repository
            assertSame(repository, HostOfferNav3JourneyProvider.requireRepository())
        } finally {
            HostOfferNav3JourneyProvider.repository = previousRepository
        }
    }
}
