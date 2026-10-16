package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class NostrootsNotesTest {
    @Test fun parsesMapNoteAndOpenLocationCode() {
        val event = """["EVENT","map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A friendly gathering","tags":[["l","8FVC9G8F+5W","open-location-code"]]}]"""
        val note = parseCommunityNote(event)
        assertNotNull(note)
        assertEquals("A friendly gathering", note?.content)
        assertEquals(1700000000000L, note?.createdAt)
        assertNotNull(decodeOpenLocationCode("8FVC9G8F+5W"))
    }

    @Test fun ignoresEventsWithoutValidLocationOrKind() {
        val event = """["EVENT","map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30398,"content":"A note","tags":[["l","bad","open-location-code"]]}]"""
        assertNull(parseCommunityNote(event))
        assertNull(decodeOpenLocationCode("bad"))
    }

    @Test fun ignoresMalformedEnvelopesAndEventsWithoutLocationTags() {
        assertNull(parseCommunityNote("not JSON"))
        assertNull(parseCommunityNote("""["EOSE","map"]"""))
        assertNull(parseCommunityNote("""["EVENT","map",null]"""))
        assertNull(parseCommunityNote(noteEvent(tags = """[["t","gathering"]]""")))
        assertNull(parseCommunityNote(noteEvent(tags = """[["l","8FVC9G8F+5W","other-code"]]""")))
        assertNull(parseCommunityNote(noteEvent(tags = """[["l"]]""")))
        assertNull(parseCommunityNote(noteEvent(tags = """[["l","not-a-location","open-location-code"]]""")))
        assertNull(parseCommunityNote(noteEvent().replace("\"tags\":", "\"other\":")))
    }

    @Test fun rejectsMalformedEventIdentifiersAndOversizedContent() {
        val validID = "a".repeat(64)
        val validAuthor = "b".repeat(64)
        val validSignature = "c".repeat(128)

        assertNull(parseCommunityNote(noteEvent(id = "short")))
        assertNull(parseCommunityNote(noteEvent(author = "z".repeat(64))))
        assertNull(parseCommunityNote(noteEvent(signature = "c".repeat(127))))
        assertNull(parseCommunityNote(noteEvent(content = "x".repeat(10_001))))

        val uppercaseHex = parseCommunityNote(
            noteEvent(id = validID.uppercase(), author = validAuthor.uppercase(), signature = validSignature.uppercase()),
        )
        assertEquals(validAuthor, uppercaseHex?.author)
    }

    @Test fun decodesGridRefinementAndRejectsUnsupportedCodeLengthsAndDigits() {
        val pairOnly = decodeOpenLocationCode("8FVC9G8F+5W")
        val gridRefined = decodeOpenLocationCode("8FVC9G8F+5W3")
        assertNotNull(pairOnly)
        assertNotNull(gridRefined)
        // Expected centre after the final grid digit narrows the latitude/longitude cell.
        assertEquals(47.3653875, gridRefined!!.first, 0.000000001)
        assertEquals(8.524796875, gridRefined.second, 0.000000001)

        assertNull(decodeOpenLocationCode("8FVC9G+"))
        assertNull(decodeOpenLocationCode("8FVC9G8F+5W234567"))
        assertNull(decodeOpenLocationCode("8FVC9G8F+5!"))
        assertNull(decodeOpenLocationCode("!FVC9G8F+5W"))
        assertEquals(
            decodeOpenLocationCode("8FVC9G8F+5W"),
            decodeOpenLocationCode("8FVC9G8F+50W"),
        )
        assertNull(decodeOpenLocationCode("V2222222"))
        assertNull(decodeOpenLocationCode("2W222222"))
    }
}

private fun noteEvent(
    id: String = "a".repeat(64),
    author: String = "b".repeat(64),
    signature: String = "c".repeat(128),
    content: String = "A friendly gathering",
    tags: String = """[["l","8FVC9G8F+5W","open-location-code"]]""",
): String = """["EVENT","map",{"id":"$id","pubkey":"$author","sig":"$signature","kind":30397,"created_at":1700000000,"content":"$content","tags":$tags}]"""
