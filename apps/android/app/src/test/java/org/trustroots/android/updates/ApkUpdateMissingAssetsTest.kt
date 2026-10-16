package org.trustroots.android.updates

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ApkUpdateMissingAssetsTest {
    @Test fun validPreviewWithoutAssetsFallsBackToUpToDateWithoutNotifying() = runBlocking {
        val response = """[
            {"tag_name":"android-preview-42","body":"Build 100042.","draft":false,"prerelease":true}
        ]"""
        var notificationCount = 0

        val parsedRelease = latestAndroidPreviewRelease(response, installedVersionCode = 100041)
        val result = checkForAndroidPreviewUpdate(
            isEnabled = { true },
            fetchRelease = { parsedRelease },
            notify = { notificationCount++ },
        )

        assertNull(parsedRelease)
        assertEquals(ApkUpdateCheckResult.UpToDate, result)
        assertEquals(0, notificationCount)
    }
}
