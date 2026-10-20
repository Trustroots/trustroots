package org.trustroots.android.updates

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ApkUpdateReleaseAssetsValidationTest {
    @Test fun skipsInvalidAssetEntriesAndSelectsNewestReleaseWithAnApk() {
        val response = """[
            {"tag_name":"android-preview-55","body":"Build 100055.","name":"Available preview 55","draft":false,"prerelease":true,"assets":[null,"not-an-object",{}, {"name":"trustroots-android-0.1-55.apk","size":0}]},
            {"tag_name":"android-preview-54","body":"Build 100054.","name":"Available preview 54","draft":false,"prerelease":true,"assets":[null,17,{"name":"trustroots-android-0.1-54.apk","size":42}]},
            {"tag_name":"android-preview-53","body":"Build 100053.","name":"Available preview 53","draft":false,"prerelease":true,"assets":null},
            {"tag_name":"android-preview-52","body":"Build 100052.","name":"Available preview 52","draft":false,"prerelease":true,"assets":"not-an-array"}
        ]"""

        val release = latestAndroidPreviewRelease(response, installedVersionCode = 100050) { "Android preview $it" }

        assertEquals(
            AndroidPreviewRelease(
                versionCode = 100054,
                versionName = "Available preview 54",
                pageUrl = "https://github.com/Trustroots/trustroots/releases/tag/android-preview-54",
            ),
            release,
        )
    }

    @Test fun returnsNoReleaseWhenAllAssetsAreNull() {
        val response = """[
            {"tag_name":"android-preview-56","body":"Build 100056.","name":"Null asset preview","draft":false,"prerelease":true,"assets":[null,null]}
        ]"""

        assertNull(latestAndroidPreviewRelease(response, installedVersionCode = 100050) { "Android preview $it" })
    }
}
