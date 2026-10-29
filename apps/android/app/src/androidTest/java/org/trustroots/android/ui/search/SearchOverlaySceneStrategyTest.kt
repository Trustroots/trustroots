package org.trustroots.android.ui.search

import androidx.navigation3.runtime.NavKey
import androidx.navigation3.scene.SceneStrategyScope
import org.junit.Assert.assertNull
import org.junit.Test

class SearchOverlaySceneStrategyTest {
    @Test fun returnsNoSceneWhenThereAreNoEntries() {
        val scope = SceneStrategyScope<NavKey>()

        val scene = with(SearchOverlaySceneStrategy) {
            scope.calculateScene(emptyList())
        }

        assertNull(scene)
    }
}
