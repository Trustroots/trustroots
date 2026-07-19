import SwiftUI

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
                            Section {
                                TextField("Filter conversations", text: $filterText)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                            }
                            .listRowInsets(EdgeInsets(top: 3, leading: 8, bottom: 3, trailing: 8))

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
                    }
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
            var loadedThreadIDs = Set<String>()

            while !Task.isCancelled {
                let pageThreads = try await api.inbox(
                    serverURLString: session.serverURLString,
                    page: page,
                    limit: pageSize
                )
                let newThreads = pageThreads.filter { loadedThreadIDs.insert($0.id).inserted }
                threads.append(contentsOf: newThreads)

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

private struct ConversationView: View {
    let otherMember: MiniMember
    @ObservedObject var session: MemberSessionStore
    @State private var messages: [DirectMessage] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var draft = ""
    @State private var isSending = false
    @State private var conversationExperience: ConversationExperience?
    @State private var hasCheckedExperience = false
    @State private var showingExperienceForm = false
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
                                Text(message.content.plainText)
                                    .padding(12)
                                    .foregroundStyle(.primary)
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
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
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
            conversationExperience = try? await api.conversationExperience(
                serverURLString: session.serverURLString,
                memberID: id
            )
            hasCheckedExperience = true
        } catch {
            errorMessage = error.localizedDescription
        }
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

    private func sendMessage() async {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty, let id = otherMember.id, !isSending else { return }

        isSending = true
        errorMessage = nil
        defer { isSending = false }

        do {
            let sentMessage = try await api.sendMessage(
                serverURLString: session.serverURLString,
                memberID: id,
                content: content
            )
            messages.insert(sentMessage, at: 0)
            draft = ""
            isDraftFocused = false
            try? await Task.sleep(for: .milliseconds(60))
            isDraftFocused = true
        } catch {
            errorMessage = error.localizedDescription
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
