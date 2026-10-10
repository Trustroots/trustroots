package org.trustroots.android.analytics

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class UsageAnalyticsTest {
    private class Consent(override var enabled: Boolean = false) : UsageConsentStore
    private class Transport : UsageTransport {
        val bodies = mutableListOf<String>()
        var cancellations = 0
        override fun send(body: String) { bodies.add(body) }
        override fun cancel() { cancellations++ }
    }

    @Test fun freshInstallAndOptOutDiscardEveryEventAndPersistTheChoice() {
        val consent = Consent()
        val transport = Transport()
        val analytics = UsageAnalytics(consent, transport)
        analytics.appOpened()
        UsageScreen.entries.forEach(analytics::screenViewed)
        assertTrue(transport.bodies.isEmpty())
        analytics.setEnabled(true)
        analytics.appOpened()
        assertTrue(UsageAnalytics(consent, transport).enabled.value)
        analytics.setEnabled(false)
        analytics.screenViewed(UsageScreen.Messages)
        analytics.appOpened()
        assertEquals(1, transport.bodies.size)
        assertEquals(1, transport.cancellations)
        assertFalse(UsageAnalytics(consent, transport).enabled.value)
    }

    @Test fun onlyFixedAnonymousFieldsAreSentForAllScreens() {
        val transport = Transport()
        val analytics = UsageAnalytics(Consent(true), transport)
        UsageScreen.entries.forEach(analytics::screenViewed)
        transport.bodies.forEachIndexed { index, body ->
            val event = JSONObject(body)
            assertEquals(setOf("type", "payload"), event.keys().asSequence().toSet())
            assertEquals("event", event.getString("type"))
            val payload = event.getJSONObject("payload")
            assertEquals(setOf("website", "hostname", "url", "title"), payload.keys().asSequence().toSet())
            assertEquals("android.trustroots.org", payload.getString("hostname"))
            assertEquals("23ec0c85-2ebc-4d85-9063-c23d90b8ded1", payload.getString("website"))
            assertEquals("/android/${UsageScreen.entries[index].path}", payload.getString("url"))
            assertEquals(UsageScreen.entries[index].title, payload.getString("title"))
        }
        analytics.appOpened()
        val payload = JSONObject(transport.bodies.last()).getJSONObject("payload")
        assertEquals("app-open", payload.getString("name"))
        assertEquals("/android/", payload.getString("url"))
        assertEquals(setOf("website", "hostname", "url", "title", "name"), payload.keys().asSequence().toSet())
    }
}
