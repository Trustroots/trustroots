package org.trustroots.shared.ui

data class PilotPerson(val id: String?, val username: String?, val name: String)

data class PilotProfile(
    val person: PilotPerson,
    val tagline: String?,
    val location: String?,
    val about: String?,
)

data class PilotThread(val id: String, val partner: PilotPerson, val excerpt: String)

data class PilotMessage(val id: String, val author: String, val content: String, val outgoing: Boolean)

/** The host owns authentication, transport and persistent drafts. Complete requests on the UI thread. */
interface PilotGateway {
    fun signIn(username: String, password: String, completion: (String?) -> Unit)
    fun signOut(completion: (String?) -> Unit)
    fun profile(username: String, completion: (PilotProfile?, String?) -> Unit)
    fun inbox(page: Int, completion: (List<PilotThread>?, String?) -> Unit)

    /** Messages are ordered newest first, as returned by the member API. */
    fun conversation(memberId: String, completion: (List<PilotMessage>?, String?) -> Unit)
    fun send(memberId: String, content: String, completion: (PilotMessage?, String?) -> Unit)
    fun loadDraft(partner: PilotPerson): String
    fun saveDraft(partner: PilotPerson, value: String)
    fun exit()
}
