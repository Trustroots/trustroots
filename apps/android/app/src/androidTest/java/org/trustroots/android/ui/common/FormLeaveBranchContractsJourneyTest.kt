package org.trustroots.android.ui.common

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FormLeaveBranchContractsJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun queuedDiscardConfirmationsCompleteThePendingNavigationOnlyOnce() {
        val completed = java.util.concurrent.atomic.AtomicInteger()
        compose.setContent {
            MaterialTheme {
                val leave = rememberFormLeave(dirty = true, saving = false, onCancel = {})
                TextButton(onClick = { leave { completed.incrementAndGet() } }) { Text("Leave form") }
            }
        }
        compose.onNodeWithText("Leave form").performClick()
        val confirm = requireNotNull(
            compose.onNodeWithText("Discard changes")
                .fetchSemanticsNode().config[SemanticsActions.OnClick].action,
        )

        // Both accessibility actions can arrive before the dialog's next composition.
        compose.runOnUiThread {
            confirm()
            confirm()
        }

        compose.onNodeWithText("Discard changes?").assertDoesNotExist()
        assertEquals(1, completed.get())
    }

    @Test
    fun registeredGuardHandlesCleanDirtySavingAndPendingActions() {
        val shellGuard = mutableStateOf<LeaveGuard?>(null)
        compose.setContent {
            var dirty by remember { mutableStateOf(false) }
            var saving by remember { mutableStateOf(false) }
            var completed by remember { mutableStateOf(0) }
            CompositionLocalProvider(LocalLeaveGuard provides shellGuard) {
                MaterialTheme {
                    rememberFormLeave(dirty, saving) { completed++ }
                    Column {
                        Text("Completed: $completed")
                        TextButton(onClick = { shellGuard.value?.invoke { completed++ } }) {
                            Text("Request navigation")
                        }
                        TextButton(onClick = { dirty = true }) { Text("Make dirty") }
                        TextButton(onClick = { saving = true }) { Text("Start saving") }
                        TextButton(onClick = { saving = false }) { Text("Finish saving") }
                    }
                }
            }
        }

        // A clean form lets navigation proceed immediately.
        compose.onNodeWithText("Request navigation").performClick()
        compose.onNodeWithText("Completed: 1").assertIsDisplayed()

        // Dirty navigation queues the requested action until the user confirms.
        compose.onNodeWithText("Make dirty").performClick()
        compose.onNodeWithText("Request navigation").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Discard changes?").assertDoesNotExist()
        compose.onNodeWithText("Completed: 1").assertIsDisplayed()

        // Saving blocks navigation. Finishing the save lets the guard queue the request.
        compose.onNodeWithText("Start saving").performClick()
        compose.onNodeWithText("Request navigation").performClick()
        compose.onNodeWithText("Completed: 1").assertIsDisplayed()
        compose.onNodeWithText("Finish saving").performClick()
        compose.onNodeWithText("Request navigation").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()

        // Confirmed navigation completes and unregisters the guard.
        compose.onNodeWithText("Request navigation").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Discard changes").performClick()
        compose.onNodeWithText("Completed: 2").assertIsDisplayed()
        compose.runOnUiThread { assertSame(null, shellGuard.value) }
    }

    @Test
    fun cancelWorksWithoutShellProviderAndResolvesDirtyConfirmation() {
        compose.setContent {
            var dirty by remember { mutableStateOf(false) }
            var cancelled by remember { mutableStateOf(false) }
            MaterialTheme {
                val cancel = rememberFormCancel(dirty, saving = false) { cancelled = true }
                Column {
                    Text(if (cancelled) "Cancelled" else "Editing")
                    TextButton(onClick = cancel) { Text("Cancel form") }
                    TextButton(onClick = { dirty = true; cancelled = false }) { Text("Make dirty") }
                }
            }
        }

        compose.onNodeWithText("Cancel form").performClick()
        compose.onNodeWithText("Cancelled").assertIsDisplayed()
        compose.onNodeWithText("Make dirty").performClick()
        compose.onNodeWithText("Cancel form").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Editing").assertIsDisplayed()
        compose.onNodeWithText("Cancel form").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Discard changes").performClick()
        compose.onNodeWithText("Cancelled").assertIsDisplayed()
    }

    @Test
    fun disposingFormPreservesAReplacementShellGuard() {
        val shellGuard = mutableStateOf<LeaveGuard?>(null)
        val replacement: LeaveGuard = { action -> action() }
        compose.setContent {
            var mounted by remember { mutableStateOf(true) }
            CompositionLocalProvider(LocalLeaveGuard provides shellGuard) {
                MaterialTheme {
                    Column {
                        if (mounted) {
                            rememberFormLeave(dirty = false, saving = false) {}
                            Text("Form mounted")
                        }
                        TextButton(onClick = { shellGuard.value = replacement }) {
                            Text("Install replacement")
                        }
                        TextButton(onClick = { mounted = false }) { Text("Unmount form") }
                    }
                }
            }
        }

        compose.onNodeWithText("Form mounted").assertIsDisplayed()
        compose.runOnUiThread { assertNotNull(shellGuard.value) }
        compose.onNodeWithText("Install replacement").performClick()
        compose.runOnUiThread { assertSame(replacement, shellGuard.value) }
        compose.onNodeWithText("Unmount form").performClick()
        compose.onNodeWithText("Form mounted").assertDoesNotExist()
        compose.runOnUiThread { assertSame(replacement, shellGuard.value) }
    }
}
