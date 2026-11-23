package org.trustroots.android.ui

import android.content.Context
import android.text.Html
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.ui.session.AppSessionEvent
import org.trustroots.android.ui.session.AppSessionSource
import org.trustroots.android.ui.session.AppSessionViewModel
import org.trustroots.shared.ui.PilotConnections
import org.trustroots.shared.ui.PilotGateway
import org.trustroots.shared.ui.PilotMessage
import org.trustroots.shared.ui.PilotNote
import org.trustroots.shared.ui.PilotPerson
import org.trustroots.shared.ui.PilotProfile
import org.trustroots.shared.ui.PilotThread

/** Adapts the existing encrypted Android session/API/cache layer to the shared pilot UI. */
internal class SharedMemberPilotGateway(
    context: Context,
    private val apiBaseUrl: String,
    private val responseCache: SecureResponseCache,
    private val sessionStore: SecureMobileSessionStore,
    private val sessionViewModel: AppSessionViewModel,
    private val scope: CoroutineScope,
    private val exitPilot: () -> Unit,
) : PilotGateway {
    private val drafts = MessageDraftStore(context.applicationContext)
    private var session: MemberSession? = null
    private var generation = 0L
    private var client: MobileApiClient? = null

    fun updateSession(value: MemberSession?) {
        if (sameSession(session, value)) return
        generation++
        session = value
        client = value?.let(::newClient)
    }

    override fun signIn(username: String, password: String, completion: (String?) -> Unit) {
        val requestGeneration = generation
        launch(requestGeneration, onFailure = completion, block = request@{
            clientForSignIn().signIn(username, password).fold(
                onSuccess = { signedIn ->
                    if (requestGeneration != generation) return@request
                    sessionViewModel.onEvent(AppSessionEvent.SignedIn(signedIn, apiBaseUrl))
                    updateSession(signedIn)
                    completion(null)
                },
                onFailure = { error ->
                    if (requestGeneration == generation) completion(errorText(error))
                },
            )
        })
    }

    override fun signOut(completion: (String?) -> Unit) {
        val active = session
        if (active == null) {
            completion(null)
            return
        }
        val requestGeneration = generation
        launch(requestGeneration, onFailure = completion, block = request@{
            val result = requireClient().signOut(active)
            if (!isCurrent(active, requestGeneration)) return@request
            val error = result.exceptionOrNull()
            if (error is MobileApiException && error.isAuthenticationFailure) {
                invalidate(active)
            } else {
                sessionViewModel.onEvent(AppSessionEvent.SignedOut(AppSessionSource.from(active, apiBaseUrl)))
                updateSession(null)
            }
            completion(error?.let(::errorText))
        })
    }

    override fun profile(username: String, completion: (PilotProfile?, String?) -> Unit) =
        authenticated(completion) { active, requestGeneration ->
            val result = requireClient().profile(active, username)
            if (!isCurrent(active, requestGeneration)) return@authenticated
            result.fold(
                onSuccess = { completion(it.toPilotProfile(), null) },
                onFailure = { error ->
                    handleFailure(active, error)
                    completion(null, errorText(error))
                },
            )
        }

    override fun featuredNotes(completion: (List<PilotNote>?, String?) -> Unit) =
        authenticated(completion) { active, requestGeneration ->
            val result = requireClient().featuredNotes()
            if (!isCurrent(active, requestGeneration)) return@authenticated
            completion(result.getOrNull(), result.exceptionOrNull()?.let(::errorText))
        }

    override fun connections(completion: (PilotConnections?, String?) -> Unit) =
        authenticated(completion) { active, requestGeneration ->
            val result = requireClient().dashboardConnections(active)
            if (!isCurrent(active, requestGeneration)) return@authenticated
            result.fold(
                onSuccess = { completion(it, null) },
                onFailure = { error ->
                    handleFailure(active, error)
                    completion(null, errorText(error))
                },
            )
        }

    override fun inbox(page: Int, completion: (List<PilotThread>?, String?) -> Unit) =
        authenticated(completion) { active, requestGeneration ->
            val result = requireClient().inbox(active, page)
            if (!isCurrent(active, requestGeneration)) return@authenticated
            result.fold(
                onSuccess = { rows ->
                    completion(rows.map { row ->
                        PilotThread(
                            id = row.id,
                            partner = PilotPerson(row.otherMember.id, row.otherMember.username, clean(row.otherMember.displayName)),
                            excerpt = clean(row.excerpt),
                        )
                    }, null)
                },
                onFailure = { error ->
                    handleFailure(active, error)
                    completion(null, errorText(error))
                },
            )
        }

    override fun conversation(memberId: String, completion: (List<PilotMessage>?, String?) -> Unit) =
        authenticated(completion) { active, requestGeneration ->
            val result = requireClient().conversation(active, memberId)
            if (!isCurrent(active, requestGeneration)) return@authenticated
            result.fold(
                onSuccess = { messages ->
                    completion(messages.map { message ->
                        PilotMessage(
                            id = message.id,
                            author = clean(message.sender.username ?: message.sender.displayName),
                            content = clean(message.content),
                            outgoing = message.sender.username.equals(active.member.username, ignoreCase = true),
                        )
                    }, null)
                },
                onFailure = { error ->
                    handleFailure(active, error)
                    completion(null, errorText(error))
                },
            )
        }

    override fun send(memberId: String, content: String, completion: (PilotMessage?, String?) -> Unit) =
        authenticated(completion) { active, requestGeneration ->
            val result = requireClient().sendMessage(active, memberId, content)
            if (!isCurrent(active, requestGeneration)) return@authenticated
            result.fold(
                onSuccess = { message ->
                    completion(
                        PilotMessage(
                            message.id,
                            clean(message.sender.username ?: message.sender.displayName),
                            clean(message.content),
                            true,
                        ),
                        null,
                    )
                },
                onFailure = { error ->
                    handleFailure(active, error)
                    completion(null, errorText(error))
                },
            )
        }

    override fun loadDraft(partner: PilotPerson): String {
        val active = session ?: return ""
        val key = partner.username ?: partner.id ?: return ""
        return drafts.load(active.member.username, key)
    }

    override fun saveDraft(partner: PilotPerson, value: String) {
        val active = session ?: return
        val key = partner.username ?: partner.id ?: return
        drafts.save(active.member.username, key, value)
    }

    override fun exit() = exitPilot()

    private fun <T> authenticated(
        completion: (T?, String?) -> Unit,
        action: suspend (MemberSession, Long) -> Unit,
    ) {
        val active = session
        if (active == null) {
            completion(null, "Please sign in to continue.")
            return
        }
        val requestGeneration = generation
        launch(requestGeneration, onFailure = { completion(null, it) }) {
            if (isCurrent(active, requestGeneration)) action(active, requestGeneration)
        }
    }

    private fun launch(requestGeneration: Long, onFailure: (String?) -> Unit, block: suspend () -> Unit) {
        scope.launch {
            try {
                if (requestGeneration == generation) block()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Throwable) {
                if (requestGeneration == generation) onFailure(errorText(error))
            }
        }
    }

    private fun isCurrent(active: MemberSession, requestGeneration: Long) =
        requestGeneration == generation && sameSession(session, active)

    private fun sameSession(left: MemberSession?, right: MemberSession?) =
        left?.credentialKey == right?.credentialKey && left?.member?.username == right?.member?.username

    private fun handleFailure(active: MemberSession, error: Throwable) {
        if (error is MobileApiException && error.isAuthenticationFailure) invalidate(active)
    }

    private fun invalidate(active: MemberSession) {
        if (!isCurrent(active, generation)) return
        sessionViewModel.onEvent(AppSessionEvent.SessionInvalidated(AppSessionSource.from(active, apiBaseUrl)))
        updateSession(null)
    }

    private fun requireClient(): MobileApiClient = requireNotNull(client) { "Pilot client has no active session." }

    private fun clientForSignIn() = client ?: MobileApiClient(apiBaseUrl, sessionStore = sessionStore)

    private fun newClient(active: MemberSession) =
        MobileApiClient(apiBaseUrl, responseCache, active.member.username, sessionStore)

    private fun errorText(error: Throwable): String = when (error) {
        is MobileApiException -> clean(error.serverMessage).ifBlank {
            when (error.failureKind) {
                ApiFailureKind.SIGN_IN_REJECTED -> "The sign in details were not accepted."
                else -> "The request could not be completed."
            }
        }
        else -> "A network error occurred. Please try again."
    }

    private fun clean(value: String?): String {
        if (value.isNullOrBlank()) return ""
        return Html.fromHtml(value, Html.FROM_HTML_MODE_COMPACT).toString().trim()
    }

    private fun MemberProfile.toPilotProfile() = PilotProfile(
        person = PilotPerson(id, username, clean(displayName)),
        tagline = clean(tagline).takeIf(String::isNotEmpty),
        location = clean(location).takeIf(String::isNotEmpty),
        about = clean(description).takeIf(String::isNotEmpty),
    )
}
