package org.trustroots.android.ui.common

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.content.Context
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.Brush
import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.trustroots.android.R

private val artworkCache = object : LruCache<String, Bitmap>(8 * 1024 * 1024) {
    override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
}

internal sealed interface ArtworkBitmapState {
    data object Loading : ArtworkBitmapState
    data class Loaded(val bitmap: Bitmap) : ArtworkBitmapState
    data object Failed : ArtworkBitmapState
}

@Composable
internal fun RemoteArtwork(
    url: URL?,
    sessionCookie: String?,
    label: String,
    size: Dp,
    background: Color = MaterialTheme.colorScheme.primary,
) {
    val bitmap = rememberArtworkBitmap(url, sessionCookie)
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(background),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(
                bitmap = requireNotNull(bitmap).asImageBitmap(),
                contentDescription = stringResource(R.string.artwork_image_description, label),
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size),
            )
        } else {
            Text(artworkInitial(label), color = readableContentColor(background))
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
    showTitle: Boolean = true,
    heroHeight: Dp = 250.dp,
    compact: Boolean = false,
    showCompactIdentity: Boolean = true,
    expandedTitleStyle: TextStyle = MaterialTheme.typography.headlineMedium,
    bottomContent: (@Composable () -> Unit)? = null,
    onProfileImageClick: (() -> Unit)? = null,
    leadingContent: (@Composable () -> Unit)? = null,
) {
    val bitmap = rememberArtworkBitmap(url, sessionCookie)
    val avatarSize = if (compact) 40.dp else 88.dp
    Box(Modifier.fillMaxWidth().height(heroHeight).background(background).testTag(testTag)) {
        if (bitmap != null) {
            Image(
                bitmap = requireNotNull(bitmap).asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(heroHeight + 20.dp).then(if (blurBackground) Modifier.blur(14.dp) else Modifier),
            )
        }
        Box(Modifier.fillMaxWidth().height(heroHeight).background(
            Brush.verticalGradient(
                if (compact) {
                    listOf(colorResource(R.color.artwork_scrim_end), colorResource(R.color.artwork_scrim_end))
                } else {
                    listOf(colorResource(R.color.artwork_scrim_start), colorResource(R.color.artwork_scrim_end))
                },
            ),
        ))
        if (compact) {
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth()) {
                if (showCompactIdentity) Row(
                    Modifier.fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = if (onProfileImageClick == null) 6.dp else 2.dp)
                        .testTag("$testTag-identity"),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    leadingContent?.invoke()
                    ProfileAvatar(
                        bitmap,
                        avatarSize,
                        label,
                        background,
                        onClick = onProfileImageClick,
                    )
                    Column(Modifier.weight(1f)) {
                        if (showTitle) {
                            Text(
                                label,
                                color = colorResource(R.color.artwork_on_scrim),
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Text(
                            subtitle,
                            color = colorResource(R.color.artwork_on_scrim),
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                bottomContent?.invoke()
            }
        } else {
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth()) {
                Column(Modifier.padding(horizontal = 20.dp, vertical = if (bottomContent == null) 20.dp else 12.dp)) {
                    ProfileAvatar(
                        bitmap,
                        avatarSize,
                        label,
                        background,
                        onClick = onProfileImageClick,
                    )
                    if (showTitle) {
                        Text(label, color = colorResource(R.color.artwork_on_scrim), style = expandedTitleStyle)
                    }
                    Text(subtitle, color = colorResource(R.color.artwork_on_scrim), style = MaterialTheme.typography.bodyMedium)
                }
                bottomContent?.invoke()
            }
        }
    }
}

@Composable
private fun ProfileAvatar(
    bitmap: Bitmap?,
    size: Dp,
    label: String,
    background: Color,
    onClick: (() -> Unit)?,
) {
    val imageDescription = stringResource(R.string.view_profile_photo, label)
    val clickModifier = if (onClick == null) {
        Modifier.size(size)
    } else {
        Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = imageDescription }
            .testTag("profileAvatar")
    }
    Box(clickModifier, contentAlignment = Alignment.Center) {
        Box(Modifier.size(size).clip(CircleShape).background(background), contentAlignment = Alignment.Center) {
            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = if (onClick == null) stringResource(R.string.artwork_image_description, label) else null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(size),
                )
            } else {
                Text(artworkInitial(label), color = readableContentColor(background))
            }
        }
    }
}

internal fun artworkInitial(label: String): String = label.take(1).uppercase()

@Composable
private fun readableContentColor(background: Color): Color {
    val luminance = background.luminance()
    val whiteContrast = 1.05f / (luminance + 0.05f)
    val blackContrast = (luminance + 0.05f) / 0.05f
    return colorResource(
        if (whiteContrast >= blackContrast) R.color.artwork_light_content else R.color.artwork_dark_content,
    )
}

@Composable
internal fun rememberArtworkBitmap(url: URL?, sessionCookie: String?): Bitmap? =
    (rememberArtworkBitmapState(url, sessionCookie) as? ArtworkBitmapState.Loaded)?.bitmap

@Composable
internal fun rememberArtworkBitmapState(
    url: URL?,
    sessionCookie: String?,
    maxDownloadBytes: Int = 2 * 1024 * 1024,
): ArtworkBitmapState {
    val context = LocalContext.current.applicationContext
    val cacheKey = "${url.orEmpty()}|${sessionCookie.orEmpty()}|$maxDownloadBytes"
    return key(cacheKey) {
        produceState<ArtworkBitmapState>(ArtworkBitmapState.Loading) {
            val cached = if (url == null) null else artworkCache.get(cacheKey)
            val bitmap = if (url == null) {
                null
            } else {
                cached ?: withContext(Dispatchers.IO) { loadArtwork(context, url, sessionCookie, maxDownloadBytes) }
            }
            currentCoroutineContext().ensureActive()
            if (cached == null && bitmap != null) artworkCache.put(cacheKey, bitmap)
            value = bitmap?.let(ArtworkBitmapState::Loaded) ?: ArtworkBitmapState.Failed
        }.value
    }
}

private fun URL?.orEmpty(): String = this?.toString().orEmpty()

private fun loadArtwork(context: Context, url: URL, sessionCookie: String?, maxDownloadBytes: Int): Bitmap? {
    val cacheDirectory = File(context.cacheDir, "circle-artwork")
    val cached = if (url.path.startsWith("/uploads-circle/")) circleImageFile(cacheDirectory, url) else null
    if (cached != null && System.currentTimeMillis() - cached.lastModified() < 7L * 24 * 60 * 60 * 1000) {
        BitmapFactory.decodeFile(cached.path)?.let { return it }
    }
    val downloaded = try {
        var current = url
        var result: Bitmap? = null
        for (attempt in 0..2) {
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
                            while (output.size() <= maxDownloadBytes) {
                                val count = input.read(chunk)
                                if (count < 0) break
                                output.write(chunk, 0, count)
                            }
                            output.toByteArray()
                        }
                        if (bytes.size > maxDownloadBytes) break
                        result = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        if (result != null && cached != null) {
                            runCatching {
                                cacheDirectory.mkdirs()
                                cached.writeBytes(bytes)
                                cacheDirectory.listFiles()?.sortedByDescending(File::lastModified)
                                    ?.drop(24)?.forEach(File::delete)
                            }
                        }
                        break
                    }
                    HttpURLConnection.HTTP_MOVED_PERM,
                    HttpURLConnection.HTTP_MOVED_TEMP,
                    HttpURLConnection.HTTP_SEE_OTHER,
                    307, 308 -> {
                        val location = connection.getHeaderField("Location") ?: break
                        val next = URL(current, location)
                        if (next.protocol != "https") break
                        current = next
                    }
                    else -> break
                }
            } finally {
                connection.disconnect()
            }
        }
        result
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        null
    }
    return downloaded ?: cached?.let { BitmapFactory.decodeFile(it.path) }
}

private fun circleImageFile(directory: File, url: URL): File {
    val digest = MessageDigest.getInstance("SHA-256").digest(url.toString().toByteArray())
        .joinToString("") { "%02x".format(it) }
    return File(directory, digest)
}
