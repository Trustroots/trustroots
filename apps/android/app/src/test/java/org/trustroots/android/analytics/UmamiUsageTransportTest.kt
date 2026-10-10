package org.trustroots.android.analytics

import java.net.CookieHandler
import java.net.CookieManager
import java.net.HttpCookie
import java.net.ServerSocket
import java.net.URI
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import org.junit.Assert.*
import org.junit.Test

class UmamiUsageTransportTest {
    @Test fun sendsAnonymousJsonWithoutGlobalCookiesAndDoesNotFollowRedirects() {
        ServerSocket(0).use { server ->
            val requests = LinkedBlockingQueue<Pair<List<String>, String>>()
            val endpoint = "http://127.0.0.1:${server.localPort}/api/send"
            val oldCookieHandler = CookieHandler.getDefault()
            val cookieManager = CookieManager()
            cookieManager.cookieStore.add(URI(endpoint), HttpCookie("connect.sid", "fictional-session"))
            CookieHandler.setDefault(cookieManager)
            val transport = UmamiUsageTransport(endpoint)
            val worker = thread(isDaemon = true) {
                while (!server.isClosed) {
                    val socket = runCatching { server.accept() }.getOrNull() ?: break
                    socket.use {
                        val reader = socket.getInputStream().bufferedReader()
                        val headers = mutableListOf<String>()
                        while (true) {
                            val line = reader.readLine() ?: break
                            if (line.isEmpty()) break
                            headers.add(line)
                        }
                        val length = headers.first { it.startsWith("Content-Length:", true) }
                            .substringAfter(':').trim().toInt()
                        val body = CharArray(length)
                        var read = 0
                        while (read < length) read += reader.read(body, read, length - read)
                        requests.put(headers to String(body))
                        socket.getOutputStream().write(
                            ("HTTP/1.1 302 Found\r\nLocation: $endpoint/redirect\r\n" +
                                "Content-Length: 0\r\nConnection: close\r\n\r\n").toByteArray(),
                        )
                    }
                }
            }
            try {
                transport.send("""{"type":"event","payload":{"url":"/android/search"}}""")
                val request = requests.poll(5, TimeUnit.SECONDS)
                assertNotNull("Expected an analytics request", request)
                val (headers, body) = requireNotNull(request)
                assertEquals("POST /api/send HTTP/1.1", headers.first())
                assertTrue(headers.any { it == "User-Agent: Trustroots-Android" })
                assertFalse(headers.any { it.startsWith("Cookie:", true) || it.startsWith("Authorization:", true) })
                assertEquals("""{"type":"event","payload":{"url":"/android/search"}}""", body)
                assertNull("Analytics must not follow redirects", requests.poll(500, TimeUnit.MILLISECONDS))
            } finally {
                transport.cancel()
                CookieHandler.setDefault(oldCookieHandler)
                server.close()
                worker.join(1_000)
            }
        }
    }
}
