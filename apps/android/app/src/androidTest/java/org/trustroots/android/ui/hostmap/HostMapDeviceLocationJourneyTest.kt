package org.trustroots.android.ui.hostmap

import android.Manifest
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.location.Location
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.core.app.ActivityOptionsCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.math.abs
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle

@RunWith(AndroidJUnit4::class)
class HostMapDeviceLocationJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val searches = CopyOnWriteArrayList<Pair<MapBounds, HostMapFilters>>()
    private val repository = object : HostMapRepository {
        override suspend fun searchOffers(bounds: MapBounds, filters: HostMapFilters): Result<List<MapOffer>> {
            searches += bounds to filters
            return Result.success(emptyList())
        }

        override suspend fun circles() = Result.success(emptyList<TrustrootsCircle>())
        override suspend fun visibleNostrAuthors(authors: Set<String>) = Result.success(emptySet<String>())
        override suspend fun places(query: String, maxResults: Int) =
            Result.success(listOf(PlaceSuggestion(query, 48.0, 2.0)))
    }
    private val model = HostMapViewModel(repository, scope = null, now = { 0L })
    private val session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron"))

    @Test fun approximateLocationRecentresAndSearchesWithActiveFilters() {
        val permission = PermissionRegistry(mapOf(Manifest.permission.ACCESS_COARSE_LOCATION to true), deferResult = true)
        val fix = CompletableDeferred<Location>()
        showMap(permission) { precise ->
            assertEquals(false, precise)
            fix.await()
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: 6 months").performClick()
        assertEquals(0, permission.requests)
        compose.onNodeWithContentDescription("Use my location").performClick()
        compose.onNodeWithContentDescription("Use my location").assertIsNotEnabled()
        compose.runOnIdle { permission.deliverResult() }
        compose.onNodeWithText("Finding your location…").assertIsDisplayed()
        compose.onNodeWithContentDescription("Use my location").assertIsNotEnabled()
        fix.complete(Location("test").apply {
            latitude = 60.0
            longitude = 24.0
        })
        compose.onNodeWithText("Approximate location").assertIsDisplayed()
        compose.waitUntil(15_000) {
            searches.any { (bounds, filters) ->
                bounds.south < 60.0 && bounds.north > 60.0 &&
                    bounds.west < 24.0 && bounds.east > 24.0 && filters.seenMonths == null
            }
        }
        assertEquals(1, permission.requests)
        compose.waitUntil(15_000) {
            val viewport = model.state.value.viewport
            abs(viewport.latitude - 60.0) < 0.01 && abs(viewport.longitude - 24.0) < 0.01
        }
    }

    @Test fun deniedPermissionKeepsMapAndAllowsPlaceSearch() {
        showMap(PermissionRegistry(emptyMap())) { error("Denied permission started a lookup") }
        val viewport = model.state.value.viewport
        compose.onNodeWithContentDescription("Use my location").performClick()
        compose.onNodeWithText("Location permission denied. You can still search or move the map.").assertIsDisplayed()
        assertEquals(viewport, model.state.value.viewport)
        compose.onNodeWithTag("placeSearchField").performTextInput("Example City")
        compose.onNodeWithTag("submittedSearchButton").performClick()
        compose.waitUntil(15_000) {
            model.state.value.viewportCommand?.viewport == MapViewport(48.0, 2.0, 9.0)
        }
    }

    @Test fun unavailableLocationKeepsMapAndAllowsRetry() {
        val permission = PermissionRegistry(mapOf(Manifest.permission.ACCESS_FINE_LOCATION to true))
        showMap(permission) { precise ->
            assertEquals(true, precise)
            null
        }
        val viewport = model.state.value.viewport
        repeat(2) {
            compose.onNodeWithContentDescription("Use my location").performClick()
            compose.onNodeWithText("Location unavailable. Try again, search or move the map.").assertIsDisplayed()
            assertEquals(viewport, model.state.value.viewport)
        }
        assertEquals(2, permission.requests)
    }

    @Test fun existingPermissionsAllowLookupWithoutPrompting() {
        val permission = PermissionRegistry(emptyMap())
        val fix = Location("test").apply { accuracy = 20f }
        val received = CopyOnWriteArrayList<Location>()
        var grantedPermission = Manifest.permission.ACCESS_FINE_LOCATION
        compose.setContent {
            val context = LocalContext.current
            val grantedContext = remember(context) {
                object : ContextWrapper(context) {
                    override fun checkPermission(permission: String, pid: Int, uid: Int): Int =
                        if (permission == grantedPermission) PackageManager.PERMISSION_GRANTED
                        else super.checkPermission(permission, pid, uid)
                }
            }
            CompositionLocalProvider(
                LocalActivityResultRegistryOwner provides permission,
                LocalContext provides grantedContext,
            ) {
                HostMapDeviceLocation(
                    onStart = {},
                    onLocation = { received += it },
                    modifier = Modifier,
                    lookup = { _, precise ->
                        assertEquals(grantedPermission == Manifest.permission.ACCESS_FINE_LOCATION, precise)
                        fix
                    },
                )
            }
        }
        compose.onNodeWithContentDescription("Use my location").performClick()
        compose.waitUntil(5_000) { received.size == 1 }
        assertSame(fix, received.single())
        compose.onNodeWithText("Approximate location").assertDoesNotExist()
        compose.runOnIdle { fix.accuracy = 2_000f }
        compose.onNodeWithContentDescription("Use my location").performClick()
        compose.onNodeWithText("Approximate location").assertIsDisplayed()
        compose.runOnIdle {
            grantedPermission = Manifest.permission.ACCESS_COARSE_LOCATION
            fix.accuracy = 20f
        }
        compose.onNodeWithContentDescription("Use my location").performClick()
        compose.waitUntil(5_000) { received.size == 3 }
        compose.onNodeWithText("Approximate location").assertIsDisplayed()
        assertEquals(0, permission.requests)
    }

    private fun showMap(permission: PermissionRegistry, lookup: suspend (Boolean) -> Location?) {
        compose.setContent {
            CompositionLocalProvider(LocalActivityResultRegistryOwner provides permission) {
                HostMapScreen(
                    api = MobileApiClient("http://127.0.0.1:1"),
                    session = session,
                    onSessionInvalidated = {},
                    viewModel = model,
                    deviceLocationLookup = { _, precise -> lookup(precise) },
                    mapViewFactory = { context -> MapView(context).apply { setUseDataConnection(false) } },
                )
            }
        }
        compose.waitUntil(15_000) { searches.isNotEmpty() }
    }

    private class PermissionRegistry(
        private val grants: Map<String, Boolean>,
        private val deferResult: Boolean = false,
    ) :
        ActivityResultRegistry(), ActivityResultRegistryOwner {
        override val activityResultRegistry = this
        var requests = 0
            private set
        private var pendingRequestCode: Int? = null

        fun deliverResult() {
            val requestCode = requireNotNull(pendingRequestCode)
            pendingRequestCode = null
            dispatchResult(requestCode, grants)
        }

        override fun <I, O> onLaunch(
            requestCode: Int,
            contract: ActivityResultContract<I, O>,
            input: I,
            options: ActivityOptionsCompat?,
        ) {
            assertEquals(
                setOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                (input as Array<*>).toSet(),
            )
            requests++
            pendingRequestCode = requestCode
            if (!deferResult) deliverResult()
        }
    }
}
