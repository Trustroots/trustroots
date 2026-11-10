package org.trustroots.android.ui.hostmap

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.withTimeoutOrNull
import org.trustroots.android.R

private const val LOCATION_TIMEOUT_MS = 12_000L
private const val APPROXIMATE_ACCURACY_METRES = 1_000f

// The control checks foreground permission. FUSED_PROVIDER is an inlined provider name.
@SuppressLint("MissingPermission", "InlinedApi")
internal suspend fun lookupDeviceLocation(context: Context, precise: Boolean): Location? {
    val manager = context.getSystemService(LocationManager::class.java) ?: return null
    val providers = manager.getProviders(true).filter { provider ->
        provider == LocationManager.FUSED_PROVIDER || provider == LocationManager.NETWORK_PROVIDER ||
            (provider == LocationManager.GPS_PROVIDER && (precise || Build.VERSION.SDK_INT >= 31))
    }
    val results = Channel<Location?>(providers.size)
    val signals = providers.mapNotNull { provider ->
        val signal = CancellationSignal()
        try {
            LocationManagerCompat.getCurrentLocation(manager, provider, signal, ContextCompat.getMainExecutor(context)) {
                results.trySend(it)
            }
            signal
        } catch (_: SecurityException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }
    return try {
        withTimeoutOrNull(LOCATION_TIMEOUT_MS) {
            repeat(signals.size) { results.receive()?.let { return@withTimeoutOrNull it } }
            null
        }
    } finally {
        signals.forEach { it.cancel() }
        results.close()
    }
}

@Composable
internal fun HostMapDeviceLocation(
    onStart: () -> Unit,
    onLocation: (Location) -> Unit,
    modifier: Modifier,
    lookup: suspend (Context, Boolean) -> Location?,
) {
    val context = LocalContext.current
    val fine = Manifest.permission.ACCESS_FINE_LOCATION
    val coarse = Manifest.permission.ACCESS_COARSE_LOCATION
    var permissionPending by rememberSaveable { mutableStateOf(false) }
    var preciseLookup by remember { mutableStateOf<Boolean?>(null) }
    var status by remember { mutableStateOf<Int?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        permissionPending = false
        when {
            grants[fine] == true -> preciseLookup = true
            grants[coarse] == true -> preciseLookup = false
            else -> status = R.string.map_location_denied
        }
    }
    LaunchedEffect(preciseLookup) {
        val precise = preciseLookup ?: return@LaunchedEffect
        val location = lookup(context, precise)
        status = when {
            location == null -> R.string.map_location_unavailable
            !precise || location.accuracy >= APPROXIMATE_ACCURACY_METRES -> R.string.map_location_approximate
            else -> null
        }
        preciseLookup = null
        location?.let(onLocation)
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        preciseLookup = null
    }
    Column(modifier, horizontalAlignment = Alignment.End) {
        val message = if (preciseLookup != null) R.string.map_locating else status
        message?.let {
            Surface(shape = MaterialTheme.shapes.small, shadowElevation = 2.dp) {
                Text(
                    stringResource(it),
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.padding(8.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        FilledIconButton(
            enabled = !permissionPending && preciseLookup == null,
            shape = MaterialTheme.shapes.small,
            colors = IconButtonDefaults.filledIconButtonColors(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
                disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            ),
            onClick = {
                onStart()
                status = null
                when {
                    ContextCompat.checkSelfPermission(context, fine) == PackageManager.PERMISSION_GRANTED -> preciseLookup = true
                    ContextCompat.checkSelfPermission(context, coarse) == PackageManager.PERMISSION_GRANTED -> preciseLookup = false
                    else -> {
                        permissionPending = true
                        permissionLauncher.launch(arrayOf(fine, coarse))
                    }
                }
            },
        ) {
            Icon(Icons.Outlined.MyLocation, contentDescription = stringResource(R.string.map_use_my_location))
        }
    }
}
