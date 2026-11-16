package org.trustroots.android.ui.common

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

internal fun Context.canPostNotifications(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
