package org.trustroots.android.api

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MessageDraftStoreStorageTest {
    private val context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private lateinit var store: MessageDraftStore
    private val selfUsername = "draft-test-${System.nanoTime()}"

    @Before
    fun setUp() {
        store = MessageDraftStore(context)
        preferences.edit().remove(MessageDraftStore.cacheKey(selfUsername, "quiet-fox")).commit()
        preferences.edit().remove(MessageDraftStore.cacheKey("other-$selfUsername", "quiet-fox")).commit()
        preferences.edit().remove(MessageDraftStore.cacheKey(selfUsername, "calm-lynx")).commit()
    }

    @After
    fun cleanUpDrafts() {
        preferences.edit().remove(MessageDraftStore.cacheKey(selfUsername, "quiet-fox")).commit()
        preferences.edit().remove(MessageDraftStore.cacheKey("other-$selfUsername", "quiet-fox")).commit()
        preferences.edit().remove(MessageDraftStore.cacheKey(selfUsername, "calm-lynx")).commit()
    }

    @Test
    fun draftsPersistByAccountAndConversation() {
        store.save(selfUsername, "quiet-fox", "A fictional message draft")
        store.save("other-$selfUsername", "quiet-fox", "A different account draft")
        store.save(selfUsername, "calm-lynx", "A different conversation draft")

        assertEquals("A fictional message draft", store.load(selfUsername, "quiet-fox"))
        assertEquals("A different account draft", store.load("other-$selfUsername", "quiet-fox"))
        assertEquals("A different conversation draft", store.load(selfUsername, "calm-lynx"))
    }

    @Test
    fun blankSaveRemovesOnlyTheMatchingDraft() {
        store.save(selfUsername, "quiet-fox", "Draft to keep")
        store.save(selfUsername, "calm-lynx", "Draft to remove")

        store.save(selfUsername, "calm-lynx", "  \n")

        assertEquals("Draft to keep", store.load(selfUsername, "quiet-fox"))
        assertEquals("", store.load(selfUsername, "calm-lynx"))
        assertTrue(preferences.contains(MessageDraftStore.cacheKey(selfUsername, "calm-lynx")).not())
    }

    @Test
    fun clearRemovesOnlyTheSelectedAccountConversationDraft() {
        store.save(selfUsername, "quiet-fox", "Draft to clear")
        store.save(selfUsername, "calm-lynx", "Draft to keep")
        store.save("other-$selfUsername", "quiet-fox", "Other account draft")

        store.clear(selfUsername, "quiet-fox")

        assertEquals("", store.load(selfUsername, "quiet-fox"))
        assertEquals("Draft to keep", store.load(selfUsername, "calm-lynx"))
        assertEquals("Other account draft", store.load("other-$selfUsername", "quiet-fox"))
    }

    private companion object {
        const val PREFERENCES_NAME = "message_drafts"
    }
}
