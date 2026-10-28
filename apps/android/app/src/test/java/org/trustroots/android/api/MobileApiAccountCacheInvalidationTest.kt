package org.trustroots.android.api

import android.content.Context
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MobileApiAccountCacheInvalidationTest {
    @Test
    fun accountUpdateInvalidatesOwnProfileWithoutDroppingOtherCategories() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(
                MockResponse(
                    code = 200,
                    body = """{"username":"quiet-fox","displayName":"Quiet Fox","email":"quiet@example.test","newsletter":true}""",
                ),
            )
            server.start()
            val account = "account-cache-${System.nanoTime()}"
            val context = RuntimeEnvironment.getApplication()
            val baseUrl = server.url("/").toString()
            val snapshots = createSnapshots(
                context,
                baseUrl,
                account,
                "/api/users/$account" to "own-profile",
                "/api/users/member-one" to "profile",
                "/api/messages?page=1&limit=50" to "inbox",
            )

            val result = MobileApiClient(baseUrl, SecureResponseCache(context), account).updateAccount(
                MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox")),
                "  quiet@example.test  ",
                newsletter = true,
            )

            assertTrue(result.isSuccess)
            assertTrue(server.takeRequest()?.method == "PUT")
            snapshots.forEach { (category, file) ->
                if (category == "own-profile") assertFalse(file.exists())
                else assertTrue(file.exists())
            }
        }
    }

    private fun createSnapshots(
        context: Context,
        server: String,
        account: String,
        vararg pathsAndCategories: Pair<String, String>,
    ): List<Pair<String, File>> {
        val directory = File(
            File(context.noBackupFilesDir, "response-cache"),
            digest("${server.trimEnd('/')}|${account.lowercase()}"),
        )
        directory.mkdirs()
        return pathsAndCategories.map { (path, category) ->
            requireNotNull(cachePolicy(path, account))
            val file = File(directory, "$category-${digest(path)}")
            file.writeBytes(byteArrayOf(1, 2, 3))
            category to file
        }
    }

    private fun digest(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
