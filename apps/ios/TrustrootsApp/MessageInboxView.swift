import SwiftUI
import TrustrootsShared

struct MessageThreadAccumulator {
    private var loadedIDs = Set<String>()
    private(set) var threads: [MessageThread] = []

    mutating func append(_ page: [MessageThread]) {
        threads.append(contentsOf: page.filter { loadedIDs.insert($0.id).inserted })
    }
}

struct MessageInboxView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var threads: [MessageThread] = []
    @State private var filterText = ""
    @State private var threadMessages: [String: [DirectMessage]] = [:]
    @State private var isSearchingThreadContent = false
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedMember: MiniMember?
    @State private var reloadID = 0

    private let api = TrustrootsAPI()

    var body: some View {
        let loadID = reloadID
        let search = searchRequest

        NavigationStack {
            ComposeMessageInbox(
                threads: filteredThreads.map(presentationThread),
                filter: filterText,
                hasThreads: !threads.isEmpty,
                isLoading: isLoading,
                isSearching: isSearchingThreadContent,
                error: errorMessage,
                serverURLString: session.serverURLString,
                onFilter: { filterText = $0 },
                onOpen: openConversation,
                onRetry: { reloadID += 1 }
            )
            .navigationDestination(isPresented: isConversationOpen) {
                if let selectedMember {
                    ConversationView(otherMember: selectedMember, session: session)
                }
            }
            .task(id: loadID) { await loadInbox(loadID: loadID) }
            .task(id: search) { await loadThreadContentIfNeeded(for: search) }
        }
    }

    private var isConversationOpen: Binding<Bool> {
        Binding(
            get: { selectedMember != nil },
            set: { isOpen in
                guard !isOpen, selectedMember != nil else { return }
                selectedMember = nil
                reloadID += 1
            }
        )
    }

    private func openConversation(threadID: String) {
        guard selectedMember == nil,
              let thread = threads.first(where: { $0.id == threadID }) else { return }
        selectedMember = thread.otherMember(excluding: session.member?.username)
    }

    private func presentationThread(_ thread: MessageThread) -> MemberInboxThread {
        let member = thread.otherMember(excluding: session.member?.username)
        let identity = MemberIdentityText(member: member)
        return MemberInboxThread(
            id: thread.id,
            memberId: member.id,
            name: identity.primary,
            handle: identity.secondary,
            excerpt: thread.message.excerpt?.plainText ?? "…",
            timestamp: thread.updated.relativeDescription,
            unread: !thread.read
        )
    }

    private var filteredThreads: [MessageThread] {
        let query = filterQuery
        guard !query.isEmpty else { return threads }
        return threads.filter { thread in
            let member = thread.otherMember(excluding: session.member?.username)
            let messages = threadMessages[thread.id] ?? []
            let fields = [member.displayName, member.username, thread.message.excerpt]
                .compactMap { $0 }
                + messages.map(\.content)
            return fields
                .joined(separator: " ")
                .localizedCaseInsensitiveContains(query)
        }
    }

    private var filterQuery: String {
        filterText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private struct SearchRequest: Equatable {
        struct ThreadVersion: Equatable {
            let id: String
            let updated: Date
        }
        let query: String
        let threads: [ThreadVersion]
    }

    private var searchRequest: SearchRequest {
        SearchRequest(query: filterQuery, threads: threads.map { .init(id: $0.id, updated: $0.updated) })
    }

    private func loadInbox(loadID: Int) async {
        guard loadID == reloadID else { return }
        isLoading = true
        errorMessage = nil
        defer {
            if loadID == reloadID { isLoading = false }
        }

        let previousVersions = Dictionary(uniqueKeysWithValues: threads.map { ($0.id, $0.updated) })
        do {
            let pageSize = 50
            var page = 1
            var accumulator = MessageThreadAccumulator()

            while !Task.isCancelled {
                let pageThreads = try await api.inbox(
                    serverURLString: session.serverURLString,
                    page: page,
                    limit: pageSize
                )
                guard !Task.isCancelled, loadID == reloadID else { return }
                for thread in pageThreads where previousVersions[thread.id] != thread.updated {
                    threadMessages.removeValue(forKey: thread.id)
                }
                accumulator.append(pageThreads)
                threads = accumulator.threads

                guard pageThreads.count == pageSize else { break }
                page += 1
                await Task.yield()
            }
        } catch {
            guard !Task.isCancelled, loadID == reloadID else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func loadThreadContentIfNeeded(for search: SearchRequest) async {
        guard search == searchRequest else { return }
        let needsContent = threads.filter { threadMessages[$0.id] == nil }
        isSearchingThreadContent = !search.query.isEmpty && !needsContent.isEmpty
        guard isSearchingThreadContent else { return }
        defer {
            if search == searchRequest { isSearchingThreadContent = false }
        }

        for thread in needsContent {
            guard !Task.isCancelled else { return }
            guard let memberID = thread.otherMember(excluding: session.member?.username).id else { continue }
            let messages = try? await api.conversation(
                serverURLString: session.serverURLString,
                memberID: memberID,
                markRead: false
            )
            guard !Task.isCancelled, search == searchRequest else { return }
            threadMessages[thread.id] = messages
        }
    }
}

@MainActor
private struct ComposeMessageInbox: UIViewControllerRepresentable {
    let threads: [MemberInboxThread]
    let filter: String
    let hasThreads: Bool
    let isLoading: Bool
    let isSearching: Bool
    let error: String?
    let serverURLString: String
    let onFilter: (String) -> Void
    let onOpen: (String) -> Void
    let onRetry: () -> Void

    final class Coordinator {
        let state = MemberInboxState()
        var onFilter: ((String) -> Void)?
        var onOpen: ((String) -> Void)?
        var onRetry: (() -> Void)?
        var serverURLString = ""
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> UIViewController {
        update(context.coordinator)
        let coordinator = context.coordinator
        return MainViewControllerKt.MemberInboxViewController(
            state: coordinator.state,
            onFilter: { [weak coordinator] filter in coordinator?.onFilter?(filter) },
            onOpen: { [weak coordinator] threadID in coordinator?.onOpen?(threadID) },
            onRetry: { [weak coordinator] in coordinator?.onRetry?() },
            createAvatar: { [weak coordinator] thread in
                guard let coordinator else { return UIViewController() }
                return makeSharedMemberAvatarController(
                    memberID: thread.memberId,
                    name: thread.name,
                    serverURLString: coordinator.serverURLString
                )
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onFilter = onFilter
        coordinator.onOpen = onOpen
        coordinator.onRetry = onRetry
        coordinator.serverURLString = serverURLString
        coordinator.state.update(
            threads: threads,
            filter: filter,
            hasThreads: hasThreads,
            isLoading: isLoading,
            isSearching: isSearching,
            error: error
        )
    }
}

struct ConversationView: View {
    let otherMember: MiniMember
    @ObservedObject var session: MemberSessionStore
    @State private var messages: [DirectMessage] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var loadError: String?
    @State private var sendError: String?
    @State private var draftError: String?
    @State private var draft = ""
    @State private var isSending = false
    @State private var conversationExperience: ConversationExperience?
    @State private var hasCheckedExperience = false
    @State private var showingExperienceForm = false

    @State private var hostingMode = false
    @State private var hostingGuests = 1
    @State private var hostingArrival = ""
    @State private var hostingDeparture = ""
    @State private var hostingDescriptionAcknowledged = false
    @State private var hostingContext: HostingContext?
    @State private var hostingContextError: String?
    @State private var hostingAcknowledgementError: String?
    @State private var hostingContextRequest: UUID?

    private let api = TrustrootsAPI()
    private let drafts = PilotMessageDraftStore()

    var body: some View {
        let key = draftKey
        VStack(spacing: 0) {
            ComposeConversation(
                messages: messages.map { message in
                    PilotMessage(
                        id: message.id,
                        author: MemberIdentityText(member: message.userFrom).primary,
                        content: messageContent(message),
                        outgoing: message.isFrom(username: key?.username)
                    )
                },
                draft: draft,
                isLoading: !hasLoaded || isLoading,
                isSending: isSending,
                canSubmitDraft: !hostingMode || canSendHosting,
                loadError: loadError,
                sendError: sendError ?? draftError,
                experience: experienceAction?.title,
                canShareExperience: experienceAction?.canShare == true,
                onDraft: { value in
                    guard let key, draftKey == key else { return }
                    draft = value
                    storeDraft(value, for: key)
                },
                onSend: {
                    guard let key else { return }
                    Task { await sendMessage(for: key) }
                },
                onRetry: {
                    guard let key else { return }
                    Task { await loadConversation(for: key) }
                },
                onShareExperience: { showingExperienceForm = true }
            )
            if let key {
                VStack(spacing: 0) {
                    if HostingReplyPolicy.shouldShow(messages: messages, username: key.username) {
                        hostingQuickReplies(for: key)
                    }
                    Toggle("Add hosting details", isOn: $hostingMode)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                    if hostingMode {
                        hostingComposerDetails(for: key)
                    }
                }
                .background(.bar)
                .disabled(isSending)
                .onChange(of: hostingMode) { _, enabled in
                    if enabled {
                        hostingDescriptionAcknowledged = false
                        Task { await loadHostingContext(for: key) }
                    } else {
                        hostingContextRequest = nil
                        hostingContext = nil
                    }
                }
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                if let username = otherMember.username {
                    NavigationLink {
                        MemberProfileView(session: session, username: username)
                    } label: {
                        conversationMemberHeader
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("View \(otherMember.displayName ?? username)'s profile")
                } else {
                    conversationMemberHeader
                }
            }
        }
        .task(id: key) {
            resetHostingDetails()
            guard let key else { return }
            draft = drafts.load(key)
            await loadConversation(for: key)
        }
        .sheet(isPresented: $showingExperienceForm) {
            if let key {
                CreateExperienceView(member: otherMember, key: key, isCurrent: { self.draftKey == key }) { createdExperience in
                    conversationExperience = createdExperience
                    showingExperienceForm = false
                }
            }
        }
    }

    private var draftKey: PilotMessageDraftStore.Key? {
        guard let username = session.member?.username, let recipientID = otherMember.id,
              let server = TrustrootsAPIConfiguration(baseURLString: session.serverURLString) else { return nil }
        return .init(server: server.normalizedURLString, username: username, recipientID: recipientID)
    }

    private var experienceAction: (title: String, canShare: Bool)? {
        guard hasCheckedExperience else { return nil }
        if let conversationExperience {
            if conversationExperience.userFromID == otherMember.id, conversationExperience.response == nil {
                return ("They shared an experience — share yours", true)
            }
            return ("There is an experience between you", false)
        }
        return messages.count >= 6 ? ("You’ve talked a while — share an experience", true) : nil
    }

    private var isLoadingHostingContext: Bool {
        hostingContextRequest != nil
    }

    private var canSendHosting: Bool {
        hasLoaded && loadError == nil &&
            hostingContext != nil && !isLoadingHostingContext &&
            HostingDetailsValidation.error(guests: hostingGuests, arrival: hostingArrival, departure: hostingDeparture) == nil &&
            (hostingContext?.acknowledgementRequired != true || hostingDescriptionAcknowledged)
    }

    private func loadHostingContext(for key: PilotMessageDraftStore.Key) async {
        guard draftKey == key, hostingMode else { return }
        let requestID = UUID()
        hostingContextRequest = requestID
        hostingContext = nil
        hostingContextError = nil
        hostingAcknowledgementError = nil
        defer {
            if hostingContextRequest == requestID {
                hostingContextRequest = nil
            }
        }
        do {
            let context = try await api.hostingContext(serverURLString: key.server, userID: key.recipientID)
            guard !Task.isCancelled, draftKey == key, hostingContextRequest == requestID else { return }
            hostingContext = context
        } catch {
            guard !Task.isCancelled, draftKey == key, hostingContextRequest == requestID else { return }
            hostingContextError = error.localizedDescription
        }
    }

    private func resetHostingDetails() {
        hostingMode = false
        hostingGuests = 1
        hostingArrival = ""
        hostingDeparture = ""
        hostingDescriptionAcknowledged = false
        hostingContextRequest = nil
        hostingContext = nil
        hostingContextError = nil
        hostingAcknowledgementError = nil
    }

    private func messageContent(_ message: DirectMessage) -> String {
        guard let details = message.hostingDetails else { return message.displayText }
        return "\(message.displayText)\n\(hostingDetailsSummary(details))"
    }

    @ViewBuilder
    private func hostingComposerDetails(for key: PilotMessageDraftStore.Key) -> some View {
        if isLoadingHostingContext {
            HStack(spacing: 8) {
                ProgressView()
                Text("Checking hosting details…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        } else if let hostingContextError {
            VStack(alignment: .leading, spacing: 6) {
                Text("Hosting details could not be checked. Retry before sending a hosting message.")
                    .font(.caption)
                Button("Retry") { Task { await loadHostingContext(for: key) } }
                    .font(.caption.weight(.semibold))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .accessibilityLabel(hostingContextError)
        } else if let hostingContext {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text(hostingContext.description.plainText)
                        .font(.caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Please read the host’s description before sharing your visit details.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Stepper("Guests: \(hostingGuests)", value: $hostingGuests, in: 1...100)
                        .font(.caption)
                    TextField("Arrival (YYYY-MM-DD, optional)", text: $hostingArrival)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.caption)
                    TextField("Departure (YYYY-MM-DD, optional)", text: $hostingDeparture)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.caption)
                    if let validation = HostingDetailsValidation.error(
                        guests: hostingGuests,
                        arrival: hostingArrival,
                        departure: hostingDeparture
                    ) {
                        Text(validation).font(.caption2).foregroundStyle(.red)
                    }
                    if let hostingAcknowledgementError {
                        Text(hostingAcknowledgementError).font(.caption).foregroundStyle(.red)
                    }
                    if hostingContext.acknowledgementRequired {
                        Toggle("I have read this host’s hosting description and requirements.", isOn: $hostingDescriptionAcknowledged)
                            .font(.caption)
                    }
                }
            }
            .frame(maxHeight: 220)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(TrustrootsPalette.paleGreen)
        }
    }

    private func hostingQuickReplies(for key: PilotMessageDraftStore.Key) -> some View {
        HStack {
            Button("Yes, I can host!") { sendQuickHostingReply(yes: true, for: key) }
                .buttonStyle(.bordered)
            Button("Sorry I can’t host") { sendQuickHostingReply(yes: false, for: key) }
                .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .disabled(!hasLoaded || isLoading || loadError != nil)
    }

    private func sendQuickHostingReply(yes: Bool, for key: PilotMessageDraftStore.Key) {
        let content = yes
            ? "<p data-hosting=\"yes\"><b><i>Yes, I can host!</i></b></p>"
            : "<p data-hosting=\"no\"><b><i>Sorry I can't host</i></b></p>"
        Task { await sendMessage(for: key, quickReply: content) }
    }

    private func hostingDetailsSummary(_ details: HostingMessageDetails) -> String {
        var summary = "Hosting · \(details.guests) \(details.guests == 1 ? "guest" : "guests")"
        if let arrival = details.arrival, let departure = details.departure {
            summary += " · \(arrival)–\(departure)"
        }
        return summary
    }

    private var conversationMemberHeader: some View {
        MemberIdentityView(
            member: otherMember,
            serverURLString: session.serverURLString,
            avatarSize: 28,
            primaryFont: .caption.weight(.semibold),
            secondaryFont: .caption2,
            secondaryForeground: .secondary,
            lineLimit: 1
        )
        .frame(maxWidth: 220)
    }

    private func loadConversation(for key: PilotMessageDraftStore.Key) async {
        guard !isLoading, draftKey == key else { return }
        isLoading = true
        loadError = nil
        defer {
            isLoading = false
            if !Task.isCancelled { hasLoaded = true }
        }

        do {
            let loaded = try await api.conversation(serverURLString: key.server, memberID: key.recipientID)
            guard !Task.isCancelled, draftKey == key else { return }
            messages = loaded
            try? await api.markMessagesRead(
                serverURLString: key.server,
                messageIDs: loaded.filter { !$0.isFrom(username: key.username) }.map(\.id)
            )
            let experience = try? await api.conversationExperience(
                serverURLString: key.server,
                memberID: key.recipientID
            )
            guard !Task.isCancelled, draftKey == key else { return }
            conversationExperience = experience
            hasCheckedExperience = true
        } catch {
            guard !Task.isCancelled, draftKey == key else { return }
            loadError = error.localizedDescription
        }
    }

    private func storeDraft(_ value: String, for key: PilotMessageDraftStore.Key) {
        do {
            try drafts.save(value, for: key)
            draftError = nil
        } catch {
            draftError = "Could not save the draft on this device."
        }
    }

    private func sendMessage(for key: PilotMessageDraftStore.Key, quickReply: String? = nil) async {
        let content = (quickReply ?? draft).trimmingCharacters(in: .whitespacesAndNewlines)
        guard draftKey == key, !content.isEmpty, !isSending, !isLoading else { return }
        let sendingHostingDetails = hostingMode && quickReply == nil
        guard !sendingHostingDetails || canSendHosting else { return }
        if quickReply != nil {
            guard hasLoaded, loadError == nil,
                  HostingReplyPolicy.shouldShow(messages: messages, username: key.username) else { return }
        }
        isSending = true
        sendError = nil
        defer { isSending = false }

        do {
            let sent = try await api.sendMessage(
                serverURLString: key.server,
                memberID: key.recipientID,
                content: content,
                hostingDescriptionAcknowledged: sendingHostingDetails && hostingContext?.acknowledgementRequired == true
                    ? hostingDescriptionAcknowledged : nil,
                hostingDetails: sendingHostingDetails ? HostingDetailsValidation.details(
                    guests: hostingGuests,
                    arrival: hostingArrival,
                    departure: hostingDeparture
                ) : nil
            )
            guard draftKey == key else { return }
            messages.removeAll { $0.id == sent.id }
            messages.insert(sent, at: 0)
            if quickReply == nil {
                draft = ""
                storeDraft("", for: key)
                if sendingHostingDetails { resetHostingDetails() }
            }
        } catch {
            guard draftKey == key else { return }
            if sendingHostingDetails && error as? TrustrootsAPIError == .hostingDescriptionAcknowledgementRequired {
                hostingDescriptionAcknowledged = false
                await loadHostingContext(for: key)
                guard draftKey == key else { return }
                hostingAcknowledgementError = "The host’s acknowledgement preference changed. Review the description and confirm to continue."
            } else {
                sendError = error.localizedDescription
            }
        }
    }
}

@MainActor
private struct ComposeConversation: UIViewControllerRepresentable {
    let messages: [PilotMessage]
    let draft: String
    let isLoading: Bool
    let isSending: Bool
    let canSubmitDraft: Bool
    let loadError: String?
    let sendError: String?
    let experience: String?
    let canShareExperience: Bool
    let onDraft: (String) -> Void
    let onSend: () -> Void
    let onRetry: () -> Void
    let onShareExperience: () -> Void

    final class Coordinator {
        let state = MemberConversationState()
        var view: ComposeConversation?
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MainViewControllerKt.MemberConversationViewController(
            state: coordinator.state,
            onDraft: { [weak coordinator] in coordinator?.view?.onDraft($0) },
            onSend: { [weak coordinator] in coordinator?.view?.onSend() },
            onRetry: { [weak coordinator] in coordinator?.view?.onRetry() },
            onShareExperience: { [weak coordinator] in coordinator?.view?.onShareExperience() }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.view = self
        coordinator.state.update(
            messages: messages,
            draft: draft,
            isLoading: isLoading,
            isSending: isSending,
            canSubmitDraft: canSubmitDraft,
            loadError: loadError,
            sendError: sendError,
            experience: experience,
            canShareExperience: canShareExperience
        )
    }
}

private struct CreateExperienceView: View {
    let member: MiniMember
    let key: PilotMessageDraftStore.Key
    let isCurrent: () -> Bool
    let onCreated: (ConversationExperience) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            ComposeExperienceForm(isSaving: isSaving, error: errorMessage) { draft in
                Task { await createExperience(draft) }
            }
            .navigationTitle("Experience with \(member.displayName ?? member.username ?? "member")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func createExperience(_ draft: MemberExperienceDraft) async {
        guard isCurrent(), !isSaving, draft.hasInteraction else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let created = try await api.createExperience(
                serverURLString: key.server,
                memberID: key.recipientID,
                met: draft.met,
                hosted: draft.hosted,
                wasGuest: draft.wasGuest,
                recommendation: draft.recommendation.wireValue,
                feedback: draft.feedback.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            guard isCurrent() else { return }
            onCreated(created)
        } catch {
            guard isCurrent() else { return }
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
private struct ComposeExperienceForm: UIViewControllerRepresentable {
    let isSaving: Bool
    let error: String?
    let onSubmit: (MemberExperienceDraft) -> Void

    final class Coordinator {
        let state = MemberExperienceFormState()
        var onSubmit: ((MemberExperienceDraft) -> Void)?
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MemberExperienceFormControllerKt.MemberExperienceFormViewController(
            state: coordinator.state,
            onSubmit: { [weak coordinator] in coordinator?.onSubmit?($0) }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onSubmit = onSubmit
        coordinator.state.updateSubmission(isSaving: isSaving, error: error)
    }
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    }
}

private extension Date {
    var relativeDescription: String {
        formatted(.relative(presentation: .numeric))
    }
}
