package org.trustroots.android.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.content.Context
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Brush
import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val artworkCache = object : LruCache<String, Bitmap>(8 * 1024 * 1024) {
    override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
}

@Composable
internal fun RemoteArtwork(
    url: URL?,
    sessionCookie: String?,
    label: String,
    size: Dp,
    background: Color = MaterialTheme.colorScheme.primary,
) {
    val context = LocalContext.current.applicationContext
    val cacheKey = "${url.orEmpty()}|${sessionCookie.orEmpty()}"
    val bitmap by produceState<Bitmap?>(null, cacheKey) {
        value = if (url == null) null else artworkCache.get(cacheKey) ?: withContext(Dispatchers.IO) {
            loadArtwork(context, url, sessionCookie)?.also { artworkCache.put(cacheKey, it) }
        }
    }
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(background),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(
                bitmap = requireNotNull(bitmap).asImageBitmap(),
                contentDescription = "$label image",
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size),
            )
        } else {
            Text(label.firstOrNull()?.uppercase().orEmpty(), color = Color.White)
        }
    }
}

@Composable
internal fun ArtworkHero(
    url: URL?,
    sessionCookie: String?,
    label: String,
    subtitle: String,
    background: Color,
    blurBackground: Boolean,
    testTag: String,
) {
    val context = LocalContext.current.applicationContext
    val cacheKey = "${url.orEmpty()}|${sessionCookie.orEmpty()}"
    val bitmap by produceState<Bitmap?>(null, cacheKey) {
        value = if (url == null) null else artworkCache.get(cacheKey) ?: withContext(Dispatchers.IO) {
            loadArtwork(context, url, sessionCookie)?.also { artworkCache.put(cacheKey, it) }
        }
    }
    Box(Modifier.fillMaxWidth().height(250.dp).background(background).testTag(testTag)) {
        if (bitmap != null) {
            Image(
                bitmap = requireNotNull(bitmap).asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(270.dp).then(if (blurBackground) Modifier.blur(14.dp) else Modifier),
            )
        }
        Box(Modifier.fillMaxWidth().height(250.dp).background(
            Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.20f), Color.Black.copy(alpha = 0.76f))),
        ))
        Column(Modifier.align(Alignment.BottomStart).padding(20.dp)) {
            Box(Modifier.size(88.dp).clip(CircleShape).background(background), contentAlignment = Alignment.Center) {
                if (bitmap != null) {
                    Image(
                        bitmap = requireNotNull(bitmap).asImageBitmap(),
                        contentDescription = "$label image",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(88.dp),
                    )
                } else {
                    Text(label.firstOrNull()?.uppercase().orEmpty(), color = Color.White)
                }
            }
            Text(label, color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
            Text(subtitle, color = Color.White, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun URL?.orEmpty(): String = this?.toString().orEmpty()

private fun loadArtwork(context: Context, url: URL, sessionCookie: String?): Bitmap? {
    val cached = if (url.path.startsWith("/uploads-circle/")) circleImageFile(context, url) else null
    if (cached != null && System.currentTimeMillis() - cached.lastModified() < 7L * 24 * 60 * 60 * 1000) {
        BitmapFactory.decodeFile(cached.path)?.let { return it }
    }
    return runCatching {
    var current = url
    repeat(3) { attempt ->
        val connection = current.openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Accept", "image/*")
            connection.setRequestProperty("User-Agent", "TrustrootsAndroid/0.1")
            if (attempt == 0) sessionCookie?.let { connection.setRequestProperty("Cookie", it) }
            when (connection.responseCode) {
                HttpURLConnection.HTTP_OK -> {
                    val bytes = connection.inputStream.use { input ->
                        val output = ByteArrayOutputStream()
                        val chunk = ByteArray(8192)
                        while (output.size() <= 2 * 1024 * 1024) {
                            val count = input.read(chunk)
                            if (count < 0) break
                            output.write(chunk, 0, count)
                        }
                        output.toByteArray()
                    }
                    if (bytes.size > 2 * 1024 * 1024) return@runCatching null
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    if (bitmap != null && cached != null) {
                        runCatching {
                            cached.parentFile?.mkdirs()
                            cached.writeBytes(bytes)
                            cached.parentFile?.listFiles()?.sortedByDescending(File::lastModified)
                                ?.drop(24)?.forEach(File::delete)
                        }
                    }
                    return@runCatching bitmap
                }
                HttpURLConnection.HTTP_MOVED_PERM,
                HttpURLConnection.HTTP_MOVED_TEMP,
                HttpURLConnection.HTTP_SEE_OTHER,
                307, 308 -> {
                    val location = connection.getHeaderField("Location") ?: return@runCatching null
                    val next = URL(current, location)
                    if (next.protocol != "https") return@runCatching null
                    current = next
                }
                else -> return@runCatching null
            }
        } finally {
            connection.disconnect()
        }
    }
    null
    }.getOrNull() ?: cached?.let { BitmapFactory.decodeFile(it.path) }
}

private fun circleImageFile(context: Context, url: URL): File {
    val digest = MessageDigest.getInstance("SHA-256").digest(url.toString().toByteArray())
        .joinToString("") { "%02x".format(it) }
    return File(context.cacheDir, "circle-artwork/$digest")
}
