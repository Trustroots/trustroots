package org.trustroots.android.analytics

import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.locks.LockSupport
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidUsageAnalyticsSingletonJourneyTest {
    @Test fun concurrentFirstGetReturnsTheInstanceCreatedInsideTheSingletonLock() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val instanceField = AndroidUsageAnalytics::class.java.getDeclaredField("instance").apply {
            isAccessible = true
        }
        val previousInstance = instanceField.get(null)
        val workerResult = AtomicReference<UsageAnalytics?>()
        val workerFailure = AtomicReference<Throwable?>()
        var worker: Thread? = null
        var createdWhileHoldingLock: UsageAnalytics? = null

        try {
            synchronized(AndroidUsageAnalytics) {
                instanceField.set(null, null)
                worker = Thread({
                    try {
                        workerResult.set(AndroidUsageAnalytics.get(context))
                    } catch (error: Throwable) {
                        workerFailure.set(error)
                    }
                }, "usage-analytics-singleton-race").apply {
                    isDaemon = true
                    start()
                }

                assertTrue("worker should block on the singleton monitor", waitUntilBlocked(worker!!))
                createdWhileHoldingLock = AndroidUsageAnalytics.get(context)
                assertNotNull(createdWhileHoldingLock)
            }

            worker!!.join(TimeUnit.SECONDS.toMillis(5))
            assertFalse("worker should finish after the singleton monitor is released", worker!!.isAlive)
            assertNull("worker get() failed", workerFailure.get())
            assertSame(createdWhileHoldingLock, workerResult.get())
            assertSame(createdWhileHoldingLock, AndroidUsageAnalytics.get(context))
        } finally {
            worker?.join(TimeUnit.SECONDS.toMillis(5))
            synchronized(AndroidUsageAnalytics) {
                instanceField.set(null, previousInstance)
            }
        }
    }

    private fun waitUntilBlocked(thread: Thread): Boolean {
        val deadline = SystemClock.elapsedRealtime() + TimeUnit.SECONDS.toMillis(2)
        while (SystemClock.elapsedRealtime() < deadline) {
            if (thread.state == Thread.State.BLOCKED) return true
            if (!thread.isAlive) return false
            LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5))
        }
        return thread.state == Thread.State.BLOCKED
    }
}
