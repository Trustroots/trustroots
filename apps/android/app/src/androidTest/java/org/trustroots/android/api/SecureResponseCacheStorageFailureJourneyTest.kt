package org.trustroots.android.api

import android.content.Context
import android.content.ContextWrapper
import android.system.Os
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.nio.file.Files
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SecureResponseCacheStorageFailureJourneyTest {
    @Test fun savesSnapshotsWhenCategoryDirectoryCannotBeListed() {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val isolatedStorage = Files.createTempDirectory(target.cacheDir.toPath(), "cache-no-list-").toFile()
        val context = isolatedContext(target, isolatedStorage)
        val cache = SecureResponseCache(context)
        val server = "https://fictional-cache-list.example.test"
        val account = "fictional-cache-${UUID.randomUUID()}"
        val paths = (1..5).map { index -> "/api/offers?southWestLat=$index" }
        var scopeDirectory: File? = null
        var originalMode: Int? = null

        try {
            paths.take(4).forEachIndexed { index, path ->
                cache.save(server, account, path, "Fictional map snapshot $index")
            }
            assertTrue(paths.take(4).all { cache.load(server, account, it) != null })
            val directory = File(isolatedStorage, "response-cache").listFiles()!!.single()
            scopeDirectory = directory
            assertTrue(directory.isDirectory)
            originalMode = Os.stat(directory.path).st_mode and 0x1ff

            assertTrue("The fixture must remove directory read access", directory.setReadable(false, false))
            assertTrue("Snapshot writes need directory write access", directory.canWrite())
            assertTrue("Snapshot creation needs directory traversal access", directory.canExecute())
            assertFalse("The test process should no longer be able to list this directory", directory.canRead())
            assertNull(directory.listFiles { file -> file.name.startsWith("map-") })

            cache.save(server, account, paths.last(), "Fictional map snapshot 4")

            paths.forEachIndexed { index, path ->
                assertEquals("Fictional map snapshot $index", cache.load(server, account, path)?.body)
            }
        } finally {
            try {
                originalMode?.let { mode ->
                    scopeDirectory?.let { directory ->
                        if (directory.exists()) Os.chmod(directory.path, mode)
                    }
                }
                cache.clear(server, account)
            } finally {
                if (isolatedStorage.exists()) {
                    assertTrue("The isolated cache directory should be removed", isolatedStorage.deleteRecursively())
                }
            }
        }
    }

    @Test fun saveSilentlyLeavesCacheMissWhenNoBackupRootIsARegularFile() {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val storageBlocker = File.createTempFile("cache-root-blocker-", ".fixture", target.cacheDir)
        val context = isolatedContext(target, storageBlocker)
        val cache = SecureResponseCache(context)
        val server = "https://fictional-cache-write.example.test"
        val account = "fictional-cache-${UUID.randomUUID()}"
        val path = "/api/users/quiet-fox"

        try {
            assertTrue(storageBlocker.isFile)
            storageBlocker.writeText("Fictional existing file")

            cache.save(server, account, path, "Fictional profile snapshot")

            assertNull(cache.load(server, account, path))
            assertTrue("A failed cache write must leave the root blocker untouched", storageBlocker.isFile)
            assertEquals("Fictional existing file", storageBlocker.readText())
        } finally {
            assertTrue("The isolated root blocker should be removed", storageBlocker.delete())
        }
    }

    private fun isolatedContext(target: Context, noBackupFilesDir: File): Context =
        object : ContextWrapper(target) {
            override fun getNoBackupFilesDir(): File = noBackupFilesDir
        }
}
