import SwiftUI

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
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            Group {
                    if isLoading && threads.isEmpty {
                        ProgressView("Loading messages…")
                    } else if let errorMessage, threads.isEmpty {
                        ContentUnavailableView(
                            "Messages unavailable",
                            systemImage: "exclamationmark.bubble",
                            description: Text(errorMessage)
                        )
                    } else if threads.isEmpty {
                        ContentUnavailableView(
                            "No conversations yet",
                            systemImage: "bubble.left.and.bubble.right",
                            description: Text("Your Trustroots conversations will appear here.")
                        )
                    } else {
                        List {
                            if isSearchingThreadContent {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text("Searching message content…")
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            ForEach(filteredThreads) { thread in
                            NavigationLink {
                                ConversationView(
                                    otherMember: thread.otherMember(excluding: session.member?.username),
                                    session: session
                                )
                            } label: {
                                MessageThreadRow(
                                    thread: thread,
                                    currentUsername: session.member?.username,
                                    serverURLString: session.serverURLString
                                )
                            }
                            .listRowInsets(EdgeInsets(top: 2, leading: 9, bottom: 2, trailing: 9))
                            }

                            if isLoading && !threads.isEmpty {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text("Loading older conversations…")
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .center)
                                .listRowSeparator(.hidden)
                            }

                            if let errorMessage, !threads.isEmpty {
                                Text("Older conversations could not be loaded: \(errorMessage)")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .listRowSeparator(.hidden)
                            }
                        }
                        .listStyle(.plain)
                        .scrollDismissesKeyboard(.interactively)
                    }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                BottomFilterField(placeholder: "Filter conversations", text: $filterText)
            }
            .task { await loadInbox() }
            .task(id: filterText) { await loadThreadContentIfNeeded() }
        }
    }

    private var filteredThreads: [MessageThread] {
        let query = filterText.trimmingCharacters(in: .whitespacesAndNewlines)
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

    private func loadInbox() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

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
                accumulator.append(pageThreads)
                threads = accumulator.threads

                if !filterText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    await loadThreadContentIfNeeded()
                }
                guard pageThreads.count == pageSize else { break }
                page += 1
                await Task.yield()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadThreadContentIfNeeded() async {
        let query = filterText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, !threads.isEmpty else { return }
        let needingContent = threads.filter { threadMessages[$0.id] == nil }
        guard !needingContent.isEmpty else { return }

        isSearchingThreadContent = true
        defer { isSearchingThreadContent = false }
        var loaded: [String: [DirectMessage]] = [:]
        for thread in needingContent {
            guard let memberID = thread.otherMember(excluding: session.member?.username).id else { continue }
            loaded[thread.id] = (try? await api.conversation(
                serverURLString: session.serverURLString,
                memberID: memberID
            )) ?? []
        }
        guard query == filterText.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
        threadMessages.merge(loaded) { _, newest in newest }
    }
}

private struct MessageThreadRow: View {
    let thread: MessageThread
    let currentUsername: String?
    let serverURLString: String

    var body: some View {
        let member = thread.otherMember(excluding: currentUsername)
        HStack(spacing: 9) {
            MemberAvatarView(
                memberID: member.id,
                displayName: member.displayName ?? member.username ?? "Trustroots member",
                serverURLString: serverURLString,
                size: 40
            )
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 5) {
                    Text(member.displayName ?? member.username ?? "Unknown member")
                        .fontWeight(thread.read ? .regular : .semibold)
                    if !thread.read {
                        Circle()
                            .fill(TrustrootsPalette.green)
                            .frame(width: 7, height: 7)
                    }
                }
                Text(thread.message.excerpt?.plainText ?? "…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Text(thread.updated.relativeDescription)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

struct ConversationView: View {
    let otherMember: MiniMember
    @ObservedObject var session: MemberSessionStore
    @State private var messages: [DirectMessage] = []
    @State private var isLoading = false
    @State private var messagesLoaded = false
    @State private var errorMessage: String?
    @State private var draft = ""
    @State private var isSending = false
    @State private var conversationExperience: ConversationExperience?
    @State private var hasCheckedExperience = false
    @State private var showingExperienceForm = false
    @State private var hostingMode = false
    @State private var hostingGuests = 1
    @State private var hostingArrival = ""
    @State private var hostingDeparture = ""
    @State private var hostingContext: HostingContext?
    @State private var isLoadingHostingContext = false
    @State private var hostingContextError: String?
    @State private var hostingAcknowledgementError: String?
    @State private var hostingDescriptionAcknowledged = false
    @FocusState private var isDraftFocused: Bool

    private let api = TrustrootsAPI()

    var body: some View {
        Group {
            if let errorMessage, messages.isEmpty {
                ContentUnavailableView("Conversation unavailable", systemImage: "exclamationmark.bubble", description: Text(errorMessage))
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if isLoading && messages.isEmpty {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text("Loading conversation…")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.top, 16)
                            }
                            ForEach(messages.reversed()) { message in
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(message.content.plainText)
                                        .foregroundStyle(.primary)
                                    if let details = message.hostingDetails {
                                        Text(hostingDetailsSummary(details))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .padding(12)
                                .background(message.isFrom(username: session.member?.username) ? TrustrootsPalette.green.opacity(0.16) : Color.secondary.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .frame(maxWidth: .infinity, alignment: message.isFrom(username: session.member?.username) ? .trailing : .leading)
                            }
                            Color.clear
                                .frame(height: 1)
                                .id("conversation-bottom")
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _, _ in
                        withAnimation(.easeOut(duration: 0.22)) {
                            proxy.scrollTo("conversation-bottom", anchor: .bottom)
                        }
                    }
                    .onChange(of: isDraftFocused) { _, focused in
                        guard focused else { return }
                        Task { @MainActor in
                            try? await Task.sleep(for: .milliseconds(220))
                            withAnimation(.easeOut(duration: 0.22)) {
                                proxy.scrollTo("conversation-bottom", anchor: .bottom)
                            }
                        }
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
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 0) {
                if HostingReplyPolicy.shouldShow(messages: messages, username: session.member?.username) {
                    hostingQuickReplies
                }
                hostingComposerDetails
                if hasCheckedExperience {
                    if let conversationExperience,
                       conversationExperience.userFromID == otherMember.id,
                       conversationExperience.response == nil {
                        Button {
                            showingExperienceForm = true
                        } label: {
                            Label("They shared an experience — share yours", systemImage: "heart.text.square.fill")
                                .font(.caption.weight(.semibold))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .foregroundStyle(TrustrootsPalette.darkGreen)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(TrustrootsPalette.paleGreen)
                    } else if conversationExperience != nil {
                        Label("There is an experience between you", systemImage: "checkmark.seal.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(TrustrootsPalette.darkGreen)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(TrustrootsPalette.paleGreen)
                    } else if messages.count >= 6 {
                        Button {
                            showingExperienceForm = true
                        } label: {
                            Label("You’ve talked a while — share an experience", systemImage: "heart.text.square")
                                .font(.caption.weight(.semibold))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .foregroundStyle(TrustrootsPalette.darkGreen)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(TrustrootsPalette.paleGreen)
                    }
                }

                HStack(alignment: .bottom, spacing: 10) {
                    TextField("Write a message", text: $draft)
                        .lineLimit(1)
                        .textInputAutocapitalization(.sentences)
                        .submitLabel(.send)
                        .onSubmit {
                            Task { await sendMessage() }
                        }
                        .focused($isDraftFocused)
                        .padding(10)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Button {
                        Task { await sendMessage() }
                    } label: {
                        if isSending {
                            ProgressView()
                                .tint(.white)
                                .frame(width: 38, height: 38)
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.title2)
                                .frame(width: 38, height: 38)
                        }
                    }
                    .foregroundStyle(.white)
                    .background(TrustrootsPalette.green)
                    .clipShape(Circle())
                    .disabled(
                        draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            || isSending
                            || !messagesLoaded
                            || (hostingMode && (!messagesLoaded || hostingContext == nil
                                || isLoadingHostingContext || hostingContextError != nil))
                            || (hostingMode && hostingContext?.acknowledgementRequired == true
                                && !hostingDescriptionAcknowledged)
                    )
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .background(.bar)
        }
        .task {
            await loadConversation()
        }
        .sheet(isPresented: $showingExperienceForm) {
            if let memberID = otherMember.id {
                CreateExperienceView(
                    member: otherMember,
                    memberID: memberID,
                    session: session
                ) { createdExperience in
                    conversationExperience = createdExperience
                    showingExperienceForm = false
                }
            }
        }
    }

    private func loadConversation() async {
        guard !isLoading, let id = otherMember.id else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            messages = try await api.conversation(serverURLString: session.serverURLString, memberID: id)
            messagesLoaded = true
            conversationExperience = try? await api.conversationExperience(
                serverURLString: session.serverURLString,
                memberID: id
            )
            hasCheckedExperience = true
        } catch {
            messagesLoaded = false
            errorMessage = error.localizedDescription
        }
    }

    private var hostingComposerDetails: some View {
        Group {
            Toggle("Add hosting details", isOn: $hostingMode)
                .font(.caption.weight(.semibold))
                .onChange(of: hostingMode) { _, enabled in
                    guard enabled else { return }
                    hostingDescriptionAcknowledged = false
                    Task { await loadHostingContext() }
                }
            if hostingMode {
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
                        Button("Retry") { Task { await loadHostingContext() } }
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
        }
    }

    private func loadHostingContext() async {
        guard !isLoadingHostingContext, let id = otherMember.id else { return }
        isLoadingHostingContext = true
        hostingContext = nil
        hostingContextError = nil
        hostingAcknowledgementError = nil
        defer { isLoadingHostingContext = false }
        do {
            hostingContext = try await api.hostingContext(
                serverURLString: session.serverURLString,
                userID: id
            )
        } catch {
            hostingContextError = error.localizedDescription
        }
    }

    private var hostingQuickReplies: some View {
        HStack {
            Button("Yes, I can host!") { sendQuickHostingReply(yes: true) }
                .buttonStyle(.bordered)
            Button("Sorry I can’t host") { sendQuickHostingReply(yes: false) }
                .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    private func sendQuickHostingReply(yes: Bool) {
        let content = yes
            ? "<p data-hosting=\"yes\"><b><i>Yes, I can host!</i></b></p>"
            : "<p data-hosting=\"no\"><b><i>Sorry I can't host</i></b></p>"
        Task { await sendMessage(contentOverride: content, ordinary: true) }
    }

    private func hostingDetailsSummary(_ details: HostingMessageDetails) -> String {
        var summary = "Hosting · \(details.guests) \(details.guests == 1 ? "guest" : "guests")"
        if let arrival = details.arrival, let departure = details.departure {
            summary += " · \(arrival)–\(departure)"
        }
        return summary
    }

    private var conversationMemberHeader: some View {
        HStack(spacing: 7) {
            MemberAvatarView(
                memberID: otherMember.id,
                displayName: otherMember.displayName ?? otherMember.username ?? "Trustroots member",
                serverURLString: session.serverURLString,
                size: 28
            )
            Text(otherMember.displayName ?? otherMember.username ?? "Messages")
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
        }
    }

    private func sendMessage(contentOverride: String? = nil, ordinary: Bool = false) async {
        let content = (contentOverride ?? draft).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty, let id = otherMember.id, !isSending else { return }
        guard messagesLoaded else { return }
        let sendingHostingDetails = hostingMode && !ordinary
        guard !sendingHostingDetails || (hostingContext != nil && hostingContextError == nil && !isLoadingHostingContext) else { return }
        guard !sendingHostingDetails || HostingDetailsValidation.error(
            guests: hostingGuests,
            arrival: hostingArrival,
            departure: hostingDeparture
        ) == nil else { return }
        guard !sendingHostingDetails || hostingContext?.acknowledgementRequired != true || hostingDescriptionAcknowledged else { return }

        isSending = true
        errorMessage = nil
        defer { isSending = false }

        do {
            let sentMessage = try await api.sendMessage(
                serverURLString: session.serverURLString,
                memberID: id,
                content: content,
                hostingDescriptionAcknowledged: sendingHostingDetails && hostingContext?.acknowledgementRequired == true
                    ? hostingDescriptionAcknowledged : nil,
                hostingDetails: sendingHostingDetails ? HostingDetailsValidation.details(
                    guests: hostingGuests,
                    arrival: hostingArrival,
                    departure: hostingDeparture
                ) : nil
            )
            messages.insert(sentMessage, at: 0)
            if contentOverride == nil {
                draft = ""
                if sendingHostingDetails {
                    hostingMode = false
                    hostingGuests = 1
                    hostingArrival = ""
                    hostingDeparture = ""
                    hostingDescriptionAcknowledged = false
                    hostingContext = nil
                    hostingContextError = nil
                    hostingAcknowledgementError = nil
                }
            }
            isDraftFocused = false
            try? await Task.sleep(for: .milliseconds(60))
            isDraftFocused = true
        } catch {
            if error as? TrustrootsAPIError == .hostingDescriptionAcknowledgementRequired {
                hostingDescriptionAcknowledged = false
                await loadHostingContext()
                hostingAcknowledgementError = "The host’s acknowledgement preference changed. Review the description and confirm to continue."
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct CreateExperienceView: View {
    let member: MiniMember
    let memberID: String
    @ObservedObject var session: MemberSessionStore
    let onCreated: (ConversationExperience) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var met = true
    @State private var hosted = false
    @State private var wasGuest = false
    @State private var recommendation = "yes"
    @State private var feedback = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("We met in person", isOn: $met)
                    Toggle("I hosted them", isOn: $hosted)
                    Toggle("I was their guest", isOn: $wasGuest)
                } header: {
                    Text("What happened?")
                } footer: {
                    Text("Select at least one interaction.")
                }
                .tint(TrustrootsPalette.green)

                Section("Would you recommend them?") {
                    Picker("Recommendation", selection: $recommendation) {
                        Text("Yes").tag("yes")
                        Text("Not sure").tag("unknown")
                        Text("No").tag("no")
                    }
                    .pickerStyle(.segmented)
                }

                Section("Public experience") {
                    TextEditor(text: $feedback)
                        .frame(minHeight: 150)
                    Text("Optional. This becomes public when the other member also shares an experience.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Experience with \(member.displayName ?? member.username ?? "member")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Sharing…" : "Share") {
                        Task { await createExperience() }
                    }
                    .disabled(isSaving || (!met && !hosted && !wasGuest))
                }
            }
        }
    }

    private func createExperience() async {
        guard !isSaving, met || hosted || wasGuest else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let created = try await api.createExperience(
                serverURLString: session.serverURLString,
                memberID: memberID,
                met: met,
                hosted: hosted,
                wasGuest: wasGuest,
                recommendation: recommendation,
                feedback: feedback.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            onCreated(created)
        } catch {
            errorMessage = error.localizedDescription
        }
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
