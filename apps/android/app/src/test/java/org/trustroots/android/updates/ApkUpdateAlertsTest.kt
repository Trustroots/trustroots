package org.trustroots.android.updates

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ApkUpdateAlertsTest {
    @Test fun selectsNewestMatchingAndroidPreview() {
        val response = """[
            {"tag_name":"general-release","body":"Build 999999.","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-1.apk","size":10}]},
            {"tag_name":"android-preview-18","body":"Build 100018.","name":"Android preview 0.1-18","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-18.apk","size":10}]},
            {"tag_name":"android-preview-20","body":"Build 100020.","name":"Android preview 0.1-20","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-20.apk","size":10}]},
            {"tag_name":"android-preview-21","body":"Build 100021.","draft":true,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-21.apk","size":10}]}
        ]"""

        val release = latestAndroidPreviewRelease(response, 100017) { "Android preview $it" }

        assertEquals(100020, release?.versionCode)
        assertEquals("Android preview 0.1-20", release?.versionName)
        assertEquals("https://github.com/Trustroots/trustroots/releases/tag/android-preview-20", release?.pageUrl)
        assertNull(latestAndroidPreviewRelease(response, 100020) { "Android preview $it" })
    }

    @Test fun rejectsPreviewWithoutApkOrBuildCode() {
        val response = """[
            {"tag_name":"android-preview-22","body":"Build 100022.","draft":false,"prerelease":true,"assets":[{"name":"source.zip","size":10}]},
            {"tag_name":"android-preview-23","body":"No build code","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-23.apk","size":10}]},
            {"tag_name":"android-preview-24","body":"Build 100024.","draft":false,"prerelease":false,"assets":[{"name":"trustroots-android-0.1-24.apk","size":10}]}
        ]"""

        assertNull(latestAndroidPreviewRelease(response, 100021) { "Android preview $it" })
    }

    @Test fun rejectsMalformedReleaseEntriesAndFallsBackToGeneratedName() {
        val response = """[
            null,
            {"tag_name":"android-preview-nope","body":"Build 100030.","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-30.apk","size":10}]},
            {"tag_name":"android-preview-30","body":"Build 100030.","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-30.apk","size":0}]},
            {"tag_name":"android-preview-31","body":"Build 100031.","name":"   ","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-31.apk","size":10}]}
        ]"""

        val release = latestAndroidPreviewRelease(response, 100029) { "Android preview $it" }

        assertEquals(
            AndroidPreviewRelease(
                versionCode = 100031,
                versionName = "Android preview 100031",
                pageUrl = "https://github.com/Trustroots/trustroots/releases/tag/android-preview-31",
            ),
            release,
        )
    }

    @Test fun checkReturnsUnavailableForDisabledOrFailedChecksAndDoesNotNotify() = runBlocking {
        var fetchCount = 0
        var notificationCount = 0

        val disabled = checkForAndroidPreviewUpdate(
            isEnabled = { false },
            fetchRelease = { fetchCount++; null },
            notify = { notificationCount++ },
        )
        val failed = checkForAndroidPreviewUpdate(
            isEnabled = { true },
            fetchRelease = { fetchCount++; error("offline") },
            notify = { notificationCount++ },
        )

        assertTrue(disabled is ApkUpdateCheckResult.Unavailable)
        assertTrue(failed is ApkUpdateCheckResult.Unavailable)
        assertEquals(1, fetchCount)
        assertEquals(0, notificationCount)
    }

    @Test fun checkRechecksOptInAfterFetchAndReportsUpToDateOrNewVersion() = runBlocking {
        val release = AndroidPreviewRelease(100032, "Preview 32", "https://example.invalid/release")
        var enabledChecks = 0
        var notification: AndroidPreviewRelease? = null
        val optedOutDuringFetch = checkForAndroidPreviewUpdate(
            isEnabled = { ++enabledChecks == 1 },
            fetchRelease = { release },
            notify = { notification = it },
        )
        val upToDate = checkForAndroidPreviewUpdate(
            isEnabled = { true },
            fetchRelease = { null },
            notify = { notification = it },
        )
        val newVersion = checkForAndroidPreviewUpdate(
            isEnabled = { true },
            fetchRelease = { release },
            notify = { notification = it },
        )

        assertTrue(optedOutDuringFetch is ApkUpdateCheckResult.Unavailable)
        assertTrue(upToDate is ApkUpdateCheckResult.UpToDate)
        assertEquals(ApkUpdateCheckResult.NewVersion(release), newVersion)
        assertEquals(release, notification)
    }

    @Test fun notificationGateRequiresPermissionOptInAndANewerVersion() {
        assertTrue(shouldPostUpdateNotification(true, true, true, 100033, 100032))
        assertFalse(shouldPostUpdateNotification(false, true, true, 100033, 100032))
        assertFalse(shouldPostUpdateNotification(true, false, true, 100033, 100032))
        assertFalse(shouldPostUpdateNotification(true, true, false, 100033, 100032))
        assertFalse(shouldPostUpdateNotification(true, true, true, 100032, 100032))
    }
}
