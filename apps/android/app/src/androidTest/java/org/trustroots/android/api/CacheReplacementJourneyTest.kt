package org.trustroots.android.api

import android.content.ContextWrapper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CacheReplacementJourneyTest {
    @Test fun replacesAnEmptyDirectoryLeftAtTheSnapshotLocation() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storage = File(context.cacheDir, "cache-replacement-${UUID.randomUUID()}")
        val isolatedContext = object : ContextWrapper(context) {
            override fun getNoBackupFilesDir(): File = storage
        }
        try {
            val cache = SecureResponseCache(isolatedContext)
            val server = "https://cache-fixture.example.test"
            val account = "quiet-fox"
            val path = "/api/users/quiet-fox"
            cache.save(server, account, path, "first snapshot")
            assertEquals("first snapshot", cache.load(server, account, path)?.body)
            val entry = File(storage, "response-cache").walkTopDown().single { it.isFile }
            assertTrue(entry.delete())
            assertTrue(entry.mkdir())

            cache.save(server, account, path, "replacement snapshot")

            assertTrue(entry.isFile)
            assertEquals("replacement snapshot", cache.load(server, account, path)?.body)
        } finally {
            storage.deleteRecursively()
        }
    }
}
