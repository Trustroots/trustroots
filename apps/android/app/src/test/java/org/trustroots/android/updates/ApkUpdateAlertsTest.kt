package org.trustroots.android.updates

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ApkUpdateAlertsTest {
    @Test fun selectsNewestMatchingAndroidPreview() {
        val response = """[
            {"tag_name":"general-release","body":"Build 999999.","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-1.apk","size":10}]},
            {"tag_name":"android-preview-18","body":"Build 100018.","name":"Android preview 0.1-18","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-18.apk","size":10}]},
            {"tag_name":"android-preview-20","body":"Build 100020.","name":"Android preview 0.1-20","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-20.apk","size":10}]},
            {"tag_name":"android-preview-21","body":"Build 100021.","draft":true,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-21.apk","size":10}]}
        ]"""

        val release = latestAndroidPreviewRelease(response, 100017)

        assertEquals(100020, release?.versionCode)
        assertEquals("Android preview 0.1-20", release?.versionName)
        assertEquals("https://github.com/Trustroots/trustroots/releases/tag/android-preview-20", release?.pageUrl)
        assertNull(latestAndroidPreviewRelease(response, 100020))
    }

    @Test fun rejectsPreviewWithoutApkOrBuildCode() {
        val response = """[
            {"tag_name":"android-preview-22","body":"Build 100022.","draft":false,"prerelease":true,"assets":[{"name":"source.zip","size":10}]},
            {"tag_name":"android-preview-23","body":"No build code","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-0.1-23.apk","size":10}]},
            {"tag_name":"android-preview-24","body":"Build 100024.","draft":false,"prerelease":false,"assets":[{"name":"trustroots-android-0.1-24.apk","size":10}]}
        ]"""

        assertNull(latestAndroidPreviewRelease(response, 100021))
    }
}
