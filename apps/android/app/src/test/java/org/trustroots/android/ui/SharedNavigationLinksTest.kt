package org.trustroots.android.ui

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * Verifies that the checked-in `SharedNavigationLinks` mirror stays in sync
 * with the canonical registry at `modules/core/shared/navigation-links.json`.
 */
class SharedNavigationLinksTest {

    private fun registryJson(): JSONObject {
        var dir: File? = File(System.getProperty("user.dir") ?: ".")
        repeat(8) {
            val candidate = File(dir, "modules/core/shared/navigation-links.json")
            if (candidate.isFile) return JSONObject(candidate.readText())
            dir = dir?.parentFile
        }
        error("modules/core/shared/navigation-links.json not found on disk")
    }

    @Test
    fun infoAndSupportLinksMatchSharedRegistry() {
        val infoAndSupport = registryJson().getJSONObject("infoAndSupport")
        val items = infoAndSupport.getJSONArray("items")
        val siteUrl = registryJson().getString("siteUrl")

        assertEquals(items.length(), SharedNavigationLinks.INFO_AND_SUPPORT.size)
        for (index in 0 until items.length()) {
            val item = items.getJSONObject(index)
            val link = SharedNavigationLinks.INFO_AND_SUPPORT[index]
            assertEquals(item.getString("id"), link.id)
            assertEquals(
                item.optString("androidLabel", item.getString("label")),
                link.label,
            )
            val href = item.getString("href")
            val expectedUrl =
                if (href.startsWith("http")) href else siteUrl + href
            assertEquals(expectedUrl, link.url)
        }
    }

    @Test
    fun infoAndSupportHeadingMatchesSharedRegistry() {
        val infoAndSupport = registryJson().getJSONObject("infoAndSupport")
        val expected = infoAndSupport.optString(
            "androidHeading",
            infoAndSupport.getString("heading"),
        )
        assertEquals(expected, SharedNavigationLinks.INFO_AND_SUPPORT_HEADING)
    }

    @Test
    fun profileExperiencesPathMatchesSharedRegistry() {
        val path = registryJson().getString("profileExperiencesPath")
        assertEquals(path, SharedNavigationLinks.PROFILE_EXPERIENCES_PATH)
        assertEquals(
            "/profile/bob/experiences/new",
            SharedNavigationLinks.profileExperiencesURL("bob"),
        )
    }

    @Test
    fun siteUrlMatchesSharedRegistry() {
        assertEquals(
            registryJson().getString("siteUrl"),
            SharedNavigationLinks.SITE_URL,
        )
    }
}
