package org.trustroots.android.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.trustroots.android.api.ContactRelationship

class ContactRemovalTargetTest {
    @Test fun absentRelationshipHasNoRemovalTarget() {
        val relationship: ContactRelationship? = null

        assertNull(relationship.toRemovalTarget())
    }

    @Test fun missingOrBlankRelationshipIdHasNoRemovalTarget() {
        listOf(null, "", " \t\n").forEach { id ->
            assertNull(ContactRelationship(id = id, confirmed = true).toRemovalTarget())
        }
    }

    @Test fun validConfirmedAndPendingRelationshipsPreserveRemovalDetails() {
        assertEquals(
            ContactRemovalTarget(id = "contact-confirmed", confirmed = true),
            ContactRelationship(id = "contact-confirmed", confirmed = true).toRemovalTarget(),
        )
        assertEquals(
            ContactRemovalTarget(id = "contact-pending", confirmed = false),
            ContactRelationship(id = "contact-pending", confirmed = false).toRemovalTarget(),
        )
    }
}
