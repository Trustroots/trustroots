package org.trustroots.android.ui

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.EOFException
import java.io.InputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/** A localhost API that can close a request without sending an HTTP response. */
internal class LocalTransportFixture(
    private val respond: (Request) -> Response?,
) : Closeable {
    data class Request(val method: String, val path: String, val body: String, val cookie: String?)
    data class Response(
        val body: String,
        val status: Int = 200,
        val headers: Map<String, String> = emptyMap(),
    )

    private val server = ServerSocket(0).apply { soTimeout = 250 }
    private val activeSocket = AtomicReference<Socket?>()
    private val failure = AtomicReference<Throwable?>()
    val requests = CopyOnWriteArrayList<Request>()
    val baseURL = "http://127.0.0.1:${server.localPort}"
    private val responder = thread(isDaemon = true, name = "local-transport-fixture") {
        try {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket.set(socket)
                try {
                    socket.soTimeout = 3_000
                    socket.use { connection ->
                        val input = connection.getInputStream()
                        val first = readLine(input) ?: throw EOFException("Missing fixture request line")
                        var length = 0
                        var cookie: String? = null
                        while (true) {
                            val header = readLine(input) ?: throw EOFException("Incomplete fixture headers")
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                length = header.substringAfter(':').trim().toInt()
                            } else if (header.startsWith("Cookie:", ignoreCase = true)) {
                                cookie = header.substringAfter(':').trim()
                            }
                        }
                        val bytes = ByteArray(length)
                        var offset = 0
                        while (offset < length) {
                            val count = input.read(bytes, offset, length - offset)
                            if (count < 0) throw EOFException("Incomplete fixture request body")
                            offset += count
                        }
                        val request = Request(
                            first.substringBefore(' '),
                            first.substringAfter(' ').substringBefore(' '),
                            String(bytes, Charsets.UTF_8),
                            cookie,
                        )
                        requests += request
                        // Returning null closes the socket before a status line is sent.
                        val response = respond(request)
                        if (response != null) {
                            val body = response.body.toByteArray(Charsets.UTF_8)
                            connection.getOutputStream().apply {
                                write("HTTP/1.1 ${response.status} Fixture\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n".toByteArray(Charsets.US_ASCII))
                                response.headers.forEach { (name, value) ->
                                    write("$name: $value\r\n".toByteArray(Charsets.US_ASCII))
                                }
                                write("\r\n".toByteArray(Charsets.US_ASCII))
                                write(body)
                                flush()
                            }
                        }
                    }
                } catch (error: Throwable) {
                    if (!server.isClosed) failure.compareAndSet(null, error)
                } finally {
                    activeSocket.compareAndSet(socket, null)
                }
            }
        } catch (error: Throwable) {
            if (!server.isClosed) failure.compareAndSet(null, error)
        }
    }

    override fun close() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder.join(2_000)
        check(!responder.isAlive) { "Local transport fixture did not stop" }
        failure.get()?.let { throw AssertionError("Local transport fixture failed", it) }
    }

    private fun readLine(input: InputStream): String? {
        val bytes = ByteArrayOutputStream()
        while (true) {
            val value = input.read()
            if (value < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
            if (value == '\n'.code) return bytes.toString(Charsets.US_ASCII.name()).removeSuffix("\r")
            bytes.write(value)
        }
    }
}
