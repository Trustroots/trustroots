package org.trustroots.android.ui.inbox

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
internal data class MessageInboxVisit(val visitID: Long) : NavKey

@Serializable
internal data class MessageConversationVisit(val memberID: String, val visitID: Long) : NavKey

@Serializable
internal data class MessageProfileVisit(val memberIDOrUsername: String, val visitID: Long) : NavKey
