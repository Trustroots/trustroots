package org.trustroots.android.analytics

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

// Only fixed destinations may reach the analytics transport. Never accept a URL or member value.
internal enum class UsageScreen(val path: String, val title: String) {
    SignIn("sign-in", "Sign in"),
    Circles("circles", "Circles"),
    Search("search", "Search"),
    Messages("messages", "Messages"),
    Menu("menu", "Menu"),
    Profile("profile", "Profile"),
    EditProfile("edit-profile", "Edit profile"),
    Contacts("contacts", "Contacts"),
    Host("hosting", "Hosting"),
    Account("account", "Account"),
}

internal interface UsageConsentStore {
    var enabled: Boolean
}

internal interface UsageTransport {
    fun send(body: String)
    fun cancel()
}

internal class UsageAnalytics(
    private val consent: UsageConsentStore,
    private val transport: UsageTransport,
) {
    private val consentState = MutableStateFlow(consent.enabled)
    val enabled = consentState.asStateFlow()

    @Synchronized
    fun setEnabled(value: Boolean) {
        consent.enabled = value
        consentState.value = value
        if (!value) transport.cancel()
    }

    fun appOpened() = track("/android/", "Trustroots Android", "app-open")

    fun screenViewed(screen: UsageScreen) = track("/android/${screen.path}", screen.title)

    @Synchronized
    private fun track(path: String, title: String, name: String? = null) {
        if (!consentState.value) return
        val payload = JSONObject()
            .put("website", "23ec0c85-2ebc-4d85-9063-c23d90b8ded1")
            .put("hostname", "android.trustroots.org")
            .put("url", path)
            .put("title", title)
        if (name != null) payload.put("name", name)
        transport.send(JSONObject().put("type", "event").put("payload", payload).toString())
    }
}
