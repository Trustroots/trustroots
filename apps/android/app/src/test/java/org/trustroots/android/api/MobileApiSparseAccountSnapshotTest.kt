package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class MobileApiSparseAccountSnapshotTest {
    @Test fun parsesTheMinimumAccountSnapshotUsingOptionalModelDefaults() {
        val account = parseAccountDetails(
            JSONObject(
                """{"username":"quiet-fox","displayName":"Quiet Fox","email":"quiet@example.test"}""",
            ),
        )

        assertEquals(AccountDetails("quiet-fox", "Quiet Fox", "quiet@example.test"), account)
        assertNull(account.emailTemporary)
        assertFalse(account.newsletter)
    }
}
