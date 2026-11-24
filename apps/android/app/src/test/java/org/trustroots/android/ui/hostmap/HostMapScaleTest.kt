package org.trustroots.android.ui.hostmap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class HostMapScaleTest {
    @Test fun aMapWithNoMeasuredWidthHasNoScale() {
        val map = MapView(RuntimeEnvironment.getApplication())
        try {
            assertNull(HostMapScale.read(map))
        } finally {
            map.onDetach()
        }
    }

    @Test fun invalidProjectedDistancesHaveNoScale() {
        for (distance in listOf(0.0, -1.0, Double.NaN, Double.POSITIVE_INFINITY)) {
            assertNull(HostMapScale.forDistance(distance, 100))
        }
    }

    @Test fun roundsDownToANiceDistanceAndKeepsThePixelRatio() {
        assertEquals(HostMapScale(500.0, 80f), HostMapScale.forDistance(625.0, 100))
        assertEquals(HostMapScale(2000.0, 80f), HostMapScale.forDistance(2500.0, 100))
        assertEquals(HostMapScale(100.0, 80f), HostMapScale.forDistance(125.0, 100))
    }
}
