package org.trustroots.android.ui.hostmap

import android.content.Context
import android.content.ContextWrapper
import android.location.Location
import android.location.LocationManager
import android.os.CancellationSignal
import java.util.concurrent.Executor
import java.util.function.Consumer
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE, shadows = [OneTimeLocationManagerShadow::class])
class HostMapDeviceLocationTest {
    private val context get() = RuntimeEnvironment.getApplication()

    @After fun resetProviders() {
        OneTimeLocationManagerShadow.providers = emptyList()
        OneTimeLocationManagerShadow.responses.clear()
        OneTimeLocationManagerShadow.signals.clear()
        OneTimeLocationManagerShadow.pending.clear()
    }

    @Test fun coarsePermissionCanUseGpsAndIgnoresPassiveProvider() = runBlocking {
        val fix = Location(LocationManager.GPS_PROVIDER)
        OneTimeLocationManagerShadow.providers = listOf(
            LocationManager.PASSIVE_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER,
        )
        OneTimeLocationManagerShadow.responses[LocationManager.GPS_PROVIDER] = { fix }

        assertSame(fix, lookupDeviceLocation(context, precise = false))
        assertEquals(setOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER), OneTimeLocationManagerShadow.signals.keys)
        assertTrue(OneTimeLocationManagerShadow.signals.values.all { it.isCanceled })
    }

    @Test fun disabledProvidersReturnUnavailable() = runBlocking {
        assertNull(lookupDeviceLocation(context, precise = true))
        assertTrue(OneTimeLocationManagerShadow.signals.isEmpty())
    }

    @Test
    @Config(sdk = [30])
    fun coarsePermissionSkipsGpsOnOlderAndroid() = runBlocking {
        OneTimeLocationManagerShadow.providers = listOf(LocationManager.GPS_PROVIDER)
        assertNull(lookupDeviceLocation(context, precise = false))
        assertTrue(OneTimeLocationManagerShadow.signals.isEmpty())
    }

    @Test fun missingLocationServiceReturnsUnavailable() = runBlocking {
        val noLocationService = object : ContextWrapper(context) {
            override fun getSystemService(name: String): Any? =
                if (name == Context.LOCATION_SERVICE) null else super.getSystemService(name)
        }
        assertNull(lookupDeviceLocation(noLocationService, precise = true))
    }

    @Test fun cancellationStopsAnOutstandingPlatformRequest() = runBlocking {
        OneTimeLocationManagerShadow.providers = listOf(LocationManager.GPS_PROVIDER)
        OneTimeLocationManagerShadow.pending += LocationManager.GPS_PROVIDER
        val lookup = launch(start = CoroutineStart.UNDISPATCHED) {
            lookupDeviceLocation(context, precise = true)
        }
        lookup.cancelAndJoin()
        assertTrue(OneTimeLocationManagerShadow.signals.getValue(LocationManager.GPS_PROVIDER).isCanceled)
    }

    @Test fun permissionAndProviderChangesReturnUnavailable() = runBlocking {
        OneTimeLocationManagerShadow.providers =
            listOf(LocationManager.FUSED_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        OneTimeLocationManagerShadow.responses[LocationManager.FUSED_PROVIDER] = { throw SecurityException() }
        OneTimeLocationManagerShadow.responses[LocationManager.NETWORK_PROVIDER] = { throw IllegalArgumentException() }

        assertNull(lookupDeviceLocation(context, precise = true))
        assertTrue(OneTimeLocationManagerShadow.signals.getValue(LocationManager.GPS_PROVIDER).isCanceled)
    }
}

@Implements(LocationManager::class)
class OneTimeLocationManagerShadow {
    @Implementation
    fun getProviders(enabledOnly: Boolean): List<String> {
        check(enabledOnly)
        return providers
    }

    @Implementation
    fun getCurrentLocation(
        provider: String,
        signal: CancellationSignal,
        executor: Executor,
        consumer: Consumer<Location?>,
    ) {
        val fix = responses[provider]?.invoke()
        signals[provider] = signal
        if (provider !in pending) consumer.accept(fix)
    }

    companion object {
        var providers: List<String> = emptyList()
        val responses = mutableMapOf<String, () -> Location?>()
        val signals = mutableMapOf<String, CancellationSignal>()
        val pending = mutableSetOf<String>()
    }
}
