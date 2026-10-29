package org.trustroots.android.ui.common

import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LanguageNameBranchContractsTest {
    @Test
    fun unsupportedIsoLocaleLookupIsSkippedWithoutDiscardingOtherMappings() {
        val tags = buildIso6393LanguageTags(
            languageTags = listOf("en", "fr", "de"),
            iso3Language = { locale ->
                if (locale.language == "fr") throw IllegalArgumentException("No ISO 639-3 mapping")
                when (locale.language) {
                    "en" -> "ENG"
                    "de" -> "DEU"
                    else -> error("Unexpected language")
                }
            },
        )

        assertEquals(mapOf("eng" to "en", "deu" to "de"), tags)
    }

    @Test
    fun displayNameFallbackRejectsBlankAndEchoedPlatformResults() {
        assertEquals(
            "French catalogue name",
            languageDisplayName("", "fr", "fra", "French catalogue name", "FRA"),
        )
        assertEquals(
            "French catalogue name",
            languageDisplayName("FR", "fr", "fra", "French catalogue name", "FRA"),
        )
        assertEquals(
            "FRA",
            languageDisplayName("FRA", "fr", "fra", null, "FRA"),
        )
        assertEquals(
            "French",
            languageDisplayName("French", "fr", "fra", "Catalogue name", "FRA"),
        )
    }

    @Test
    fun mandinkaWithoutCatalogueFallsBackToTheOriginalUppercaseCode() {
        assertEquals("MNK", languageName("mnk", Locale.ENGLISH, emptyMap()))
    }

    @Test
    fun concurrentCatalogueReadersShareTheFirstLoadedValue() {
        val cache = LanguageCatalogueCache()
        val loaderCalls = AtomicInteger()
        val secondLoaderCalls = AtomicInteger()
        val firstFailure = AtomicReference<Throwable?>()
        val secondFailure = AtomicReference<Throwable?>()
        val loaded = mapOf("iso_639_3-eng" to "English")
        val loaderEntered = CountDownLatch(1)
        val releaseLoader = CountDownLatch(1)
        val secondStarted = CountDownLatch(1)
        val firstResult = AtomicReference<Map<String, String>?>()
        val secondResult = AtomicReference<Map<String, String>?>()
        val first = Thread({
            try {
                firstResult.set(cache.get {
                    loaderCalls.incrementAndGet()
                    loaderEntered.countDown()
                    check(releaseLoader.await(5, TimeUnit.SECONDS)) { "Timed out releasing the test loader" }
                    loaded
                })
            } catch (failure: Throwable) {
                firstFailure.set(failure)
            }
        }, "language-catalogue-first-reader")
        val second = Thread({
            try {
                secondStarted.countDown()
                secondResult.set(cache.get {
                    secondLoaderCalls.incrementAndGet()
                    mapOf("wrong" to "Second loader ran")
                })
            } catch (failure: Throwable) {
                secondFailure.set(failure)
            }
        }, "language-catalogue-second-reader")

        try {
            first.start()
            assertTrue(loaderEntered.await(5, TimeUnit.SECONDS))
            second.start()
            assertTrue(secondStarted.await(5, TimeUnit.SECONDS))
            awaitBlockedOnCacheLock(second)
            releaseLoader.countDown()
            first.join(TimeUnit.SECONDS.toMillis(5))
            second.join(TimeUnit.SECONDS.toMillis(5))

            assertFalse("Both cache readers should finish", first.isAlive || second.isAlive)
            firstFailure.get()?.let { throw AssertionError("First cache read failed", it) }
            secondFailure.get()?.let { throw AssertionError("Second cache read failed", it) }
            assertEquals(1, loaderCalls.get())
            assertEquals(0, secondLoaderCalls.get())
            assertEquals(loaded, firstResult.get())
            assertEquals(loaded, secondResult.get())
        } finally {
            releaseLoader.countDown()
            first.join(TimeUnit.SECONDS.toMillis(5))
            if (second.isAlive) second.join(TimeUnit.SECONDS.toMillis(5))
        }
    }

    private fun awaitBlockedOnCacheLock(thread: Thread) {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
        while (thread.isAlive && thread.state != Thread.State.BLOCKED && System.nanoTime() < deadline) {
            Thread.yield()
        }
        assertEquals("Second reader should pass the empty-cache check and wait on the cache lock", Thread.State.BLOCKED, thread.state)
    }
}
