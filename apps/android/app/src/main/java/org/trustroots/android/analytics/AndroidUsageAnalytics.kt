package org.trustroots.android.analytics

import android.content.Context
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.Call
import okhttp3.Callback
import okhttp3.CookieJar
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

internal class AndroidUsageConsentStore(context: Context) : UsageConsentStore {
    private val preferences = context.applicationContext
        .getSharedPreferences("usage-analytics", Context.MODE_PRIVATE)

    override var enabled: Boolean
        get() = preferences.getBoolean("enabled", false)
        set(value) { preferences.edit().putBoolean("enabled", value).apply() }
}

internal class UmamiUsageTransport(
    private val endpoint: String = "https://1p.trustroots.org/api/send",
) : UsageTransport {
    // Separate from the authenticated API client, with no cookies, redirects or retries.
    private val client = OkHttpClient.Builder()
        .cookieJar(CookieJar.NO_COOKIES)
        .followRedirects(false)
        .followSslRedirects(false)
        .retryOnConnectionFailure(false)
        .callTimeout(3, TimeUnit.SECONDS)
        .build()

    override fun send(body: String) {
        val request = Request.Builder()
            .url(endpoint)
            .header("User-Agent", "Trustroots-Android")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) = Unit
            override fun onResponse(call: Call, response: Response) { response.close() }
        })
    }

    override fun cancel() { client.dispatcher.cancelAll() }
}

internal object AndroidUsageAnalytics {
    @Volatile private var instance: UsageAnalytics? = null

    fun get(context: Context): UsageAnalytics = instance ?: synchronized(this) {
        instance ?: UsageAnalytics(AndroidUsageConsentStore(context), UmamiUsageTransport())
            .also { instance = it }
    }
}
