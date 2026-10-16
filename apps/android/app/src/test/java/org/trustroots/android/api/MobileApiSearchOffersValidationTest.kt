package org.trustroots.android.api

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.io.InputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileApiSearchOffersValidationTest {
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))

    @Test fun rejectsInvalidBoundsFiltersAndSeenMonthRangesWithValidationErrors() {
        val api = MobileApiClient("http://127.0.0.1:1")
        val invalidResults = listOf(
            runBlocking { api.searchOffers(session, south = 52.0, west = -1.0, north = 50.0, east = 1.0) },
            runBlocking { api.searchOffers(session, south = 50.0, west = 1.0, north = 52.0, east = 1.0) },
            runBlocking {
                api.searchOffers(
                    session, south = 50.0, west = -1.0, north = 52.0, east = 1.0,
                    types = emptySet(),
                )
            },
            runBlocking {
                api.searchOffers(
                    session, south = 50.0, west = -1.0, north = 52.0, east = 1.0,
                    types = setOf("host", "sleep"),
                )
            },
            runBlocking {
                api.searchOffers(
                    session, south = 50.0, west = -1.0, north = 52.0, east = 1.0,
                    seenMonths = 0,
                )
            },
            runBlocking {
                api.searchOffers(
                    session, south = 50.0, west = -1.0, north = 52.0, east = 1.0,
                    seenMonths = 25,
                )
            },
        )

        invalidResults.forEach { result ->
            assertFalse(result.isSuccess)
            assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        }
    }

    @Test fun omitsOptionalSeenAndLanguageFiltersWhenNoneAreSelected() {
        val (result, request) = withLocalOffersResponse("""{"features":[]}""") { baseUrl ->
            runBlocking {
                MobileApiClient(baseUrl).searchOffers(
                    session = session,
                    south = 50.0,
                    west = -1.0,
                    north = 52.0,
                    east = 1.0,
                    types = setOf("host"),
                    circleIDs = emptySet(),
                    seenMonths = null,
                    languages = emptySet(),
                )
            }
        }

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().isEmpty())
        assertTrue(request.line.startsWith("GET /api/offers?southWestLat=50.0&southWestLng=-1.0&northEastLat=52.0&northEastLng=1.0&filters="))
        val encodedFilters = request.line.substringAfter("&filters=").substringBefore(" HTTP/1.1")
        val filters = JSONObject(URLDecoder.decode(encodedFilters, StandardCharsets.UTF_8.name()))
        assertEquals(listOf("host"), filters.getJSONArray("types").strings())
        assertEquals(0, filters.getJSONArray("tribes").length())
        assertFalse(filters.has("seen"))
        assertFalse(filters.has("languages"))
        assertTrue(request.headers.any { it.equals("Cookie: ${session.cookieHeader}", ignoreCase = true) })
    }
}

private data class OffersRequest(val line: String, val headers: List<String>)

private fun <T> withLocalOffersResponse(
    responseBody: String,
    call: (String) -> T,
): Pair<T, OffersRequest> {
    val server = ServerSocket(0).apply { soTimeout = 1_000 }
    val captured = LinkedBlockingQueue<OffersRequest>()
    val failure = AtomicReference<Throwable?>(null)
    val activeSocket = AtomicReference<Socket?>(null)
    val worker = thread(isDaemon = true, name = "mobile-api-offers-fixture") {
        try {
            val socket = server.accept()
            activeSocket.set(socket)
            socket.use { connection ->
                connection.soTimeout = 2_000
                val input = connection.getInputStream()
                val requestLine = readOffersAsciiLine(input)
                    ?: throw EOFException("Local offers request closed before its request line")
                val headers = mutableListOf<String>()
                var contentLength = 0
                while (true) {
                    val header = readOffersAsciiLine(input) ?: break
                    if (header.isEmpty()) break
                    headers += header
                    if (header.startsWith("Content-Length:", ignoreCase = true)) {
                        contentLength = header.substringAfter(':').trim().toInt()
                    }
                }
                val body = ByteArray(contentLength)
                var offset = 0
                while (offset < body.size) {
                    val count = input.read(body, offset, body.size - offset)
                    if (count < 0) throw EOFException("Local offers request ended before its Content-Length")
                    offset += count
                }
                captured.put(OffersRequest(requestLine, headers))
                val responseBytes = responseBody.toByteArray(Charsets.UTF_8)
                connection.getOutputStream().apply {
                    write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${responseBytes.size}\r\nConnection: close\r\n\r\n"
                            .toByteArray(Charsets.US_ASCII),
                    )
                    write(responseBytes)
                    flush()
                }
            }
        } catch (error: SocketTimeoutException) {
            failure.compareAndSet(null, error)
        } catch (error: SocketException) {
            if (!server.isClosed) failure.compareAndSet(null, error)
        } catch (error: IOException) {
            if (!server.isClosed) failure.compareAndSet(null, error)
        } catch (error: InterruptedException) {
            Thread.currentThread().interrupt()
            failure.compareAndSet(null, error)
        } finally {
            activeSocket.set(null)
        }
    }

    try {
        val result = call("http://127.0.0.1:${server.localPort}")
        val request = captured.poll(3, TimeUnit.SECONDS)
            ?: throw AssertionError("The local offers request was not captured", failure.get())
        worker.join(2_000)
        assertTrue("The local offers responder should finish after one request", !worker.isAlive)
        failure.get()?.let { throw AssertionError("The local offers responder failed", it) }
        return result to request
    } finally {
        server.close()
        activeSocket.getAndSet(null)?.close()
        worker.join(2_000)
    }
}

private fun readOffersAsciiLine(input: InputStream): String? {
    val line = ByteArrayOutputStream()
    while (true) {
        val next = input.read()
        if (next < 0) return if (line.size() == 0) null else String(line.toByteArray(), Charsets.US_ASCII)
        if (next == '\n'.code) break
        if (next != '\r'.code) line.write(next)
    }
    return String(line.toByteArray(), Charsets.US_ASCII)
}

private fun org.json.JSONArray.strings(): List<String> =
    (0 until length()).map { getString(it) }
