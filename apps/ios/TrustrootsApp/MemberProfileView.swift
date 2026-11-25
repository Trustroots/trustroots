import SwiftUI
import TrustrootsShared

struct MemberProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var session: MemberSessionStore
    let username: String?
    let editProfile: (() -> Void)?
    let openCircles: (() -> Void)?
    @State private var profile: MemberProfile?
    @State private var contacts: [TrustrootsContact] = []
    @State private var experiences: [MemberExperience] = []
    @State private var accommodationOffer: AccommodationOffer?
    @State private var selectedProfileUsername: String?
    @State private var isConversationOpen = false
    @State private var showAllContacts = false
    @State private var showAllExperiences = false
    @State private var errorMessage: String?
    @State private var isLoading = false
    @State private var isBlocked = false
    @State private var isUpdatingBlock = false
    @State private var showBlockConfirmation = false
    @State private var showReportMember = false
    @State private var showHostingEditor = false
    @State private var safetyErrorMessage: String?

    private let api = TrustrootsAPI()

    init(
        session: MemberSessionStore,
        username: String? = nil,
        editProfile: (() -> Void)? = nil,
        openCircles: (() -> Void)? = nil
    ) {
        self.session = session
        self.username = username
        self.editProfile = editProfile
        self.openCircles = openCircles
    }

    var body: some View {
        Group {
                if isLoading && profile == nil {
                    ProgressView("Loading profile…")
                } else if let errorMessage {
                    VStack(spacing: 18) {
                        ContentUnavailableView(
                            "Profile unavailable",
                            systemImage: "person.crop.circle.badge.exclamationmark",
                            description: Text(errorMessage)
                        )
                        if errorMessage == TrustrootsAPIError.authenticationRequired.localizedDescription {
                            Button("Sign out", role: .destructive) {
                                Task { await session.signOut() }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                } else if let profile {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 22) {
                            VStack(alignment: .leading, spacing: 9) {
                                if username != nil {
                                    Button {
                                        dismiss()
                                    } label: {
                                        Image(systemName: "chevron.backward")
                                            .font(.title2.weight(.bold))
                                            .foregroundStyle(.primary)
                                            .frame(width: 46, height: 46)
                                            .background(.ultraThickMaterial)
                                            .clipShape(Circle())
                                            .shadow(color: .black.opacity(0.18), radius: 8, y: 3)
                                    }
                                    .accessibilityLabel("Back")
                                    .accessibilityIdentifier("profile-header-back")
                                }

                                MemberIdentityView(
                                    member: MiniMember(
                                        id: profile.id,
                                        username: profile.username,
                                        displayName: profile.displayName
                                    ),
                                    serverURLString: session.serverURLString,
                                    avatarSize: 84,
                                    primaryFont: .title.bold(),
                                    secondaryFont: .subheadline,
                                    foreground: .white,
                                    secondaryForeground: .white.opacity(0.86)
                                )
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityIdentifier("profile-header-identity")
                                if let tagline = profile.tagline, !tagline.isEmpty {
                                    Text(tagline.plainText)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(.white)
                                        .lineLimit(2)
                                        .padding(.leading, 94)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, username == nil ? 76 : 52)
                            .padding(.bottom, 20)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background {
                                MemberAvatarImageView(
                                    memberID: profile.id,
                                    displayName: profile.displayName,
                                    serverURLString: session.serverURLString
                                )
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .scaleEffect(1.15)
                                .blur(radius: 12)
                                .clipped()
                                .overlay(.black.opacity(0.42))
                            }
                            .padding(.horizontal, -20)
                            .padding(.top, -20)

                            let messageLabel = !isOwnProfile(profile) && !isBlocked && profile.id != nil
                                ? "Open or start a conversation with \(profile.displayName)" : nil
                            if editProfile != nil || messageLabel != nil {
                                ProfileActionsSection(
                                    canEdit: editProfile != nil,
                                    messageLabel: messageLabel,
                                    onEdit: editProfile ?? {},
                                    onHosting: { showHostingEditor = true },
                                    onMessage: { isConversationOpen = true }
                                )
                            }

                            ProfileDetailsSection(profile: profile, onLocation: openOnSearchMap)

                            if let description = profile.description?.plainText, !description.isEmpty {
                                ProfileTextSection(title: "About me", text: description, tag: "profile-biography")
                            }

                            if let accommodationOffer {
                                if let label = meetingAvailabilityLabel(accommodationOffer.meetingStatus) {
                                    Label(label, systemImage: "person.2")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(TrustrootsPalette.darkGreen)
                                }
                                HostingDetailsView(
                                    status: accommodationOffer.status,
                                    description: accommodationOffer.description,
                                    noOfferDescription: accommodationOffer.noOfferDescription,
                                    maxGuests: accommodationOffer.maxGuests,
                                    volunteering: accommodationOffer.volunteering == true
                                )
                            }

                            if let languages = profile.languages, !languages.isEmpty {
                                ProfileTextSection(
                                    title: languages.count < 5 ? "Languages" : nil,
                                    text: languages.map { TrustrootsLanguage.displayName(for: $0) }.joined(separator: " · "),
                                    tag: "profile-languages"
                                )
                            }

                            if let memberships = profile.member, !memberships.isEmpty {
                                circlesSection(memberships.map(\.tribe))
                            }

                            if !contacts.isEmpty {
                                ProfileContactsSection(
                                    contacts: contacts,
                                    serverURLString: session.serverURLString,
                                    expanded: $showAllContacts,
                                    onOpen: openRelatedProfile
                                )
                            }

                            if !experiences.isEmpty {
                                ProfileExperiencesSection(
                                    experiences: experiences,
                                    serverURLString: session.serverURLString,
                                    expanded: $showAllExperiences,
                                    onOpen: openRelatedProfile
                                )
                            }

                            if !isOwnProfile(profile) {
                                ProfileSafetySection(
                                    blockedMessage: isBlocked ? "You have blocked \(profile.displayName)." : nil,
                                    isUpdating: isUpdatingBlock,
                                    error: safetyErrorMessage,
                                    onReport: { showReportMember = true },
                                    onToggleBlock: { showBlockConfirmation = true }
                                )
                            }
                        }
                        .padding(20)
                    }
                } else {
                    ContentUnavailableView(
                        "Profile unavailable",
                        systemImage: "person.crop.circle.badge.exclamationmark",
                        description: Text("Your signed-in profile could not be loaded. Please try again.")
                    )
                }
            }
            .task {
                if shouldOpenCanonicalOwnProfile {
                    NotificationCenter.default.post(name: .trustrootsOpenOwnProfile, object: nil)
                } else {
                    await loadProfile()
                }
            }
            .navigationDestination(item: $selectedProfileUsername) { username in
                MemberProfileView(session: session, username: username)
            }
            .navigationDestination(isPresented: $isConversationOpen) {
                if let profile, let memberID = profile.id {
                    ConversationView(
                        otherMember: MiniMember(
                            id: memberID,
                            username: profile.username,
                            displayName: profile.displayName
                        ),
                        session: session
                    )
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .onReceive(NotificationCenter.default.publisher(for: .trustrootsReturnToMap)) { _ in
                dismiss()
            }
            .sheet(isPresented: $showHostingEditor) {
                HostingOfferEditorView(session: session) {
                    Task { await loadProfile() }
                }
            }
            .sheet(isPresented: $showReportMember) {
                if let profile {
                    ReportMemberView(
                        session: session,
                        username: profile.username,
                        displayName: profile.displayName
                    )
                }
            }
            .confirmationDialog(
                isBlocked ? "Unblock this member?" : "Block this member?",
                isPresented: $showBlockConfirmation,
                titleVisibility: .visible
            ) {
                if isBlocked {
                    Button("Unblock member") {
                        Task { await updateBlock(blocked: false) }
                    }
                } else {
                    Button("Block member", role: .destructive) {
                        Task { await updateBlock(blocked: true) }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                if isBlocked {
                    Text("They will be able to see your profile and message you again.")
                } else {
                    Text("They will no longer be able to see your profile or message you.")
                }
            }
    }

    private var shouldOpenCanonicalOwnProfile: Bool {
        guard editProfile == nil,
              let username,
              let signedInUsername = session.member?.username else { return false }
        return username.caseInsensitiveCompare(signedInUsername) == .orderedSame
    }

    private func isOwnProfile(_ profile: MemberProfile) -> Bool {
        guard let signedInUsername = session.member?.username else { return false }
        return profile.username.caseInsensitiveCompare(signedInUsername) == .orderedSame
    }

    private func meetingAvailabilityLabel(_ status: String?) -> String? {
        switch status {
        case "yes": return "Wants to meet people"
        case "maybe": return "Maybe up for meeting"
        case "no": return "Too busy to meet people"
        default: return nil
        }
    }

    private func loadProfile() async {
        guard !isLoading, let username = username ?? session.member?.username else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let loadedProfile = try await api.profile(serverURLString: session.serverURLString, username: username)
            profile = loadedProfile
            if !isOwnProfile(loadedProfile) {
                let blockedMembers = (try? await api.blockedMembers(
                    serverURLString: session.serverURLString
                )) ?? []
                isBlocked = blockedMembers.contains { member in
                    if let memberID = member.id, let loadedID = loadedProfile.id {
                        return memberID == loadedID
                    }
                    return member.username?.caseInsensitiveCompare(loadedProfile.username) == .orderedSame
                }
            }
            if let userID = loadedProfile.id {
                async let loadedContacts = api.contacts(serverURLString: session.serverURLString, userID: userID)
                async let loadedExperiences = api.experiences(serverURLString: session.serverURLString, userID: userID)
                async let loadedAccommodation = api.accommodationOffer(
                    serverURLString: session.serverURLString,
                    userID: userID
                )
                contacts = (try? await loadedContacts) ?? []
                experiences = (try? await loadedExperiences) ?? []
                accommodationOffer = try? await loadedAccommodation
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func updateBlock(blocked: Bool) async {
        guard !isUpdatingBlock, let profile else { return }
        isUpdatingBlock = true
        safetyErrorMessage = nil
        defer { isUpdatingBlock = false }

        do {
            try await api.setMemberBlocked(
                serverURLString: session.serverURLString,
                username: profile.username,
                blocked: blocked
            )
            isBlocked = blocked
        } catch {
            safetyErrorMessage = error.localizedDescription
        }
    }

    private func circlesSection(_ circles: [ProfileCircle]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            FlowLayout(spacing: 8) {
                ForEach(circles) { circle in
                    NavigationLink {
                        ProfileCircleDetailView(session: session, circle: circle)
                    } label: {
                        Text(circle.label)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(TrustrootsPalette.darkGreen)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(TrustrootsPalette.green.opacity(0.12))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(TrustrootsPalette.paleGreen)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func openOnSearchMap(_ location: String) {
        NotificationCenter.default.post(name: .trustrootsOpenMapLocation, object: location)
    }

    private func openRelatedProfile(_ username: String) {
        if selectedProfileUsername == nil { selectedProfileUsername = username }
    }
}

private struct ProfileContactsSection: View {
    let contacts: [TrustrootsContact]
    let serverURLString: String
    @Binding var expanded: Bool
    let onOpen: (String) -> Void

    var body: some View {
        let identity = Identity(serverURLString: serverURLString, contacts: contacts.map(Contact.init), expanded: expanded)
        MeasuredProfileSection(identity: identity) { onHeight in
            MainViewControllerKt.MemberProfileContactsViewController(
                contacts: identity.contacts.map(\.presentation),
                expanded: identity.expanded,
                onOpen: onOpen,
                onToggle: { expanded.toggle() },
                onHeight: { onHeight($0.doubleValue) },
                createAvatar: { contact in
                    makeSharedMemberAvatarController(
                        memberID: contact.memberId,
                        name: contact.name,
                        serverURLString: serverURLString
                    )
                }
            )
        }
    }

    private struct Identity: Hashable {
        let serverURLString: String
        let contacts: [Contact]
        let expanded: Bool
    }

    private struct Contact: Hashable {
        let id: String
        let memberID: String?
        let username: String?
        let name: String
        let handle: String?

        init(_ contact: TrustrootsContact) {
            let identity = MemberIdentityText(member: contact.user)
            id = contact.id
            memberID = contact.user.id
            username = contact.user.username
            name = identity.primary
            handle = identity.secondary
        }

        var presentation: MemberContact {
            MemberContact(id: id, memberId: memberID, username: username, name: name, handle: handle, pending: false)
        }
    }
}

private struct ProfileExperiencesSection: View {
    let experiences: [MemberExperience]
    let serverURLString: String
    @Binding var expanded: Bool
    let onOpen: (String) -> Void

    var body: some View {
        let identity = Identity(serverURLString: serverURLString, experiences: experiences.map(Entry.init), expanded: expanded)
        MeasuredProfileSection(identity: identity) { onHeight in
            MainViewControllerKt.MemberProfileExperiencesViewController(
                experiences: identity.experiences.map(\.presentation),
                expanded: identity.expanded,
                onOpen: onOpen,
                onToggle: { expanded.toggle() },
                onHeight: { onHeight($0.doubleValue) },
                createAvatar: { person in
                    makeSharedMemberAvatarController(
                        memberID: person.id,
                        name: person.name,
                        serverURLString: serverURLString
                    )
                }
            )
        }
    }

    private struct Identity: Hashable {
        let serverURLString: String
        let experiences: [Entry]
        let expanded: Bool
    }

    private struct Entry: Hashable {
        let id: String
        let feedback: Feedback
        let response: Feedback?
        let met: Bool
        let hostedThem: Bool
        let hostedByThem: Bool

        init(_ experience: MemberExperience) {
            id = experience.id
            feedback = Feedback(member: experience.userFrom, text: experience.feedbackPublic, recommend: experience.recommend)
            if let reply = experience.response, let text = reply.feedbackPublic, !text.plainText.isEmpty {
                response = Feedback(member: experience.userTo, text: text, recommend: reply.recommend)
            } else {
                response = nil
            }
            met = experience.interactions?.met == true
            hostedThem = experience.interactions?.guest == true
            hostedByThem = experience.interactions?.host == true
        }

        var presentation: MemberProfileExperience {
            MemberProfileExperience(
                id: id,
                feedback: feedback.presentation,
                response: response?.presentation,
                met: met,
                hostedThem: hostedThem,
                hostedByThem: hostedByThem
            )
        }
    }

    private struct Feedback: Hashable {
        let id: String?
        let username: String?
        let name: String
        let handle: String?
        let text: String?
        let recommend: String?

        init(member: MiniMember, text: String?, recommend: String?) {
            let identity = MemberIdentityText(member: member)
            id = member.id
            username = member.username
            name = identity.primary
            handle = identity.secondary
            self.text = text?.plainText
            self.recommend = recommend
        }

        var presentation: MemberProfileExperienceFeedback {
            MemberProfileExperienceFeedback(
                person: MemberProfileExperiencePerson(id: id, username: username, name: name, handle: handle),
                text: text.flatMap { $0.isEmpty ? nil : $0 },
                recommend: recommend
            )
        }
    }
}

private struct ProfileActionsSection: View {
    let canEdit: Bool
    let messageLabel: String?
    let onEdit: () -> Void
    let onHosting: () -> Void
    let onMessage: () -> Void

    var body: some View {
        MeasuredProfileSection(identity: Identity(canEdit: canEdit, messageLabel: messageLabel)) { onHeight in
            MainViewControllerKt.MemberProfileActionsViewController(
                canEdit: canEdit,
                messageLabel: messageLabel,
                onEdit: onEdit,
                onHosting: onHosting,
                onMessage: onMessage,
                onHeight: { onHeight($0.doubleValue) }
            )
        }
    }

    private struct Identity: Hashable {
        let canEdit: Bool
        let messageLabel: String?
    }
}

private struct ProfileSafetySection: View {
    let blockedMessage: String?
    let isUpdating: Bool
    let error: String?
    let onReport: () -> Void
    let onToggleBlock: () -> Void

    var body: some View {
        let identity = Identity(blockedMessage: blockedMessage, isUpdating: isUpdating, error: error)
        MeasuredProfileSection(identity: identity) { onHeight in
            MainViewControllerKt.MemberProfileSafetyViewController(
                blockedMessage: blockedMessage,
                isUpdating: isUpdating,
                error: error,
                onReport: onReport,
                onToggleBlock: onToggleBlock,
                onHeight: { onHeight($0.doubleValue) }
            )
        }
    }

    private struct Identity: Hashable {
        let blockedMessage: String?
        let isUpdating: Bool
        let error: String?
    }
}

private struct ProfileTextSection: View {
    let title: String?
    let text: String
    let tag: String

    var body: some View {
        MeasuredProfileSection(identity: text) { onHeight in
            MainViewControllerKt.MemberProfileTextViewController(
                title: title,
                text: text,
                accessibilityTag: tag,
                onHeight: { onHeight($0.doubleValue) }
            )
        }
    }
}

private struct ProfileDetailsSection: View {
    let profile: MemberProfile
    let onLocation: (String) -> Void

    var body: some View {
        let details = Details(
            lastLogin: profile.seen?.formatted(.relative(presentation: .named)) ?? "Long ago",
            replyRate: Self.nonEmpty(profile.replyRate) ?? "Not available yet",
            replyTime: Self.nonEmpty(profile.replyTime).map { "Within \($0)" },
            living: profile.locationLiving.flatMap { $0.isEmpty ? nil : $0 },
            origin: profile.locationFrom.flatMap { $0.isEmpty ? nil : $0 }
        )
        MeasuredProfileSection(identity: details) { onHeight in
            MainViewControllerKt.MemberProfileDetailsViewController(
                lastLogin: details.lastLogin,
                replyRate: details.replyRate,
                replyTime: details.replyTime,
                living: details.living,
                origin: details.origin,
                onLocation: onLocation,
                onHeight: { onHeight($0.doubleValue) }
            )
        }
    }

    private struct Details: Hashable {
        let lastLogin: String
        let replyRate: String
        let replyTime: String?
        let living: String?
        let origin: String?
    }

    private static func nonEmpty(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let trimmed, !trimmed.isEmpty else { return nil }
        return trimmed
    }
}

private struct MeasuredProfileSection<ID: Hashable>: View {
    let identity: ID
    let makeController: (@escaping (Double) -> Void) -> ProfileSectionHost
    @State private var height: CGFloat = 1
    @State private var origin: CGPoint = .zero

    var body: some View {
        ProfileSectionController(makeController: makeController, origin: origin, height: $height)
            .id(identity)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipped()
            .onGeometryChange(for: CGPoint.self) { $0.frame(in: .global).origin } action: { origin = $0 }
    }
}

@MainActor
private struct ProfileSectionController: UIViewControllerRepresentable {
    let makeController: (@escaping (Double) -> Void) -> ProfileSectionHost
    let origin: CGPoint
    @Binding var height: CGFloat

    final class Coordinator {
        var host: ProfileSectionHost?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let measuredHeight = $height
        let host = makeController { value in
            let next = max(1, CGFloat(value))
            Task { @MainActor in
                if measuredHeight.wrappedValue != next {
                    measuredHeight.wrappedValue = next
                }
            }
        }
        context.coordinator.host = host
        host.updateOrigin(x: Double(origin.x), y: Double(origin.y))
        return host.viewController
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        context.coordinator.host?.updateOrigin(x: Double(origin.x), y: Double(origin.y))
    }
}

private struct ReportMemberView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var session: MemberSessionStore
    let username: String
    let displayName: String
    @State private var message = ""
    @State private var isSending = false
    @State private var isSent = false
    @State private var errorMessage: String?
    @FocusState private var messageIsFocused: Bool

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            Group {
                if isSent {
                    ContentUnavailableView(
                        "Report sent",
                        systemImage: "checkmark.circle.fill",
                        description: Text("Thank you. The Trustroots support team will review your report.")
                    )
                } else {
                    Form {
                        Section("Reported member") {
                            LabeledContent("Member", value: "\(displayName) (@\(username))")
                        }

                        Section {
                            TextEditor(text: $message)
                                .frame(minHeight: 150)
                                .focused($messageIsFocused)
                                .accessibilityLabel("Describe your concern")
                        } header: {
                            Text("What happened?")
                        } footer: {
                            Text("This message goes to Trustroots support, not to the member. Please include enough detail for the support team to understand and investigate.")
                        }

                        if let errorMessage {
                            Section {
                                Text(errorMessage)
                                    .foregroundStyle(.red)
                            }
                        }

                        Section {
                            Button {
                                Task { await sendReport() }
                            } label: {
                                HStack {
                                    Spacer()
                                    if isSending {
                                        ProgressView()
                                    } else {
                                        Label("Send report", systemImage: "flag.fill")
                                    }
                                    Spacer()
                                }
                            }
                            .disabled(
                                message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    || isSending
                            )
                        } footer: {
                            Text("If anyone is in immediate danger or a crime has occurred, contact local emergency services.")
                        }
                    }
                }
            }
            .navigationTitle("Report member to support")
            .navigationBarTitleDisplayMode(.inline)
            .interactiveDismissDisabled(isSending)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isSent ? "Done" : "Cancel") {
                        dismiss()
                    }
                    .disabled(isSending)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        messageIsFocused = false
                    }
                }
            }
        }
    }

    private func sendReport() async {
        guard !isSending else { return }
        let trimmedMessage = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return }
        isSending = true
        errorMessage = nil
        messageIsFocused = false
        defer { isSending = false }

        do {
            try await api.sendSupportMessage(
                serverURLString: session.serverURLString,
                message: trimmedMessage,
                reportMember: username
            )
            message = ""
            isSent = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct HostingDetailsView: View {
    let status: String?
    let description: String?
    let noOfferDescription: String?
    let maxGuests: Int?
    var volunteering = false
    var compact = false

    private var isHosting: Bool {
        status == "yes" || status == "maybe"
    }

    private var statusLabel: String {
        switch status {
        case "yes": return "Hosting travellers"
        case "maybe": return "Maybe hosting"
        default: return "Not hosting currently"
        }
    }

    private var statusColor: Color {
        switch status {
        case "yes": return TrustrootsPalette.hostYes
        case "maybe": return TrustrootsPalette.hostMaybe
        default: return .secondary
        }
    }

    private var details: String? {
        let value = isHosting ? description : noOfferDescription
        guard let text = value?.plainText, !text.isEmpty else { return nil }
        return text
    }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 5 : 9) {
            Label(statusLabel, systemImage: "sofa.fill")
                .font((compact ? Font.subheadline : Font.headline).weight(.semibold))
                .foregroundStyle(statusColor)

            if isHosting && volunteering {
                Label("Offers volunteering", systemImage: "hand.raised")
                    .font(compact ? .caption : .subheadline)
                    .foregroundStyle(.secondary)
            }

            if let details {
                Text(details)
                    .font(compact ? .caption : .body)
                    .foregroundStyle(.secondary)
                    .lineLimit(compact ? 2 : nil)
            }

            if isHosting, let maxGuests {
                Label(
                    maxGuests == 1 ? "Space for 1 guest" : "Space for up to \(maxGuests) guests",
                    systemImage: "person.2"
                )
                .font(compact ? .caption2 : .subheadline)
                .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(compact ? 10 : 16)
        .background(statusColor.opacity(0.11))
        .clipShape(RoundedRectangle(cornerRadius: compact ? 12 : 16, style: .continuous))
    }
}

private extension String {
    var plainText: String { TrustrootsRichText.plainText(self) }
}

enum TrustrootsRichText {
    static func plainText(_ value: String) -> String {
        value.replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "</p>", with: "\n", options: [.caseInsensitive])
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
    }
}

enum TrustrootsLanguage {
    static let names = [
        "ger": "German", "deu": "German", "eng": "English", "fre": "French", "fra": "French",
        "ita": "Italian", "dut": "Dutch", "nld": "Dutch", "por": "Portuguese", "rus": "Russian",
        "spa": "Spanish", "cat": "Catalan", "gsw": "Swiss German", "swe": "Swedish", "nor": "Norwegian", "dan": "Danish",
        "fin": "Finnish", "pol": "Polish", "ces": "Czech", "cze": "Czech", "ukr": "Ukrainian",
        "tur": "Turkish", "ara": "Arabic", "rum": "Romanian", "ron": "Romanian", "jpn": "Japanese", "kor": "Korean", "zho": "Chinese",
        "chi": "Chinese", "hin": "Hindi", "heb": "Hebrew", "ell": "Greek", "gre": "Greek"
    ]

    static func displayName(for code: String) -> String {
        names[code.lowercased()]
            ?? Locale(identifier: "en").localizedString(forLanguageCode: code)
            ?? code.uppercased()
    }

    static let commonCodes = ["eng", "por", "spa", "fre", "ger", "ita", "dut", "rus", "pol", "tur", "ara", "jpn", "glg"]

    static let availableCodes: [String] = {
        let letters = Array("abcdefghijklmnopqrstuvwxyz")
        let recognised = letters.flatMap { first in
            letters.flatMap { second in
                letters.compactMap { third -> String? in
                    let code = String([first, second, third])
                    return Locale(identifier: "en").localizedString(forLanguageCode: code) == nil ? nil : code
                }
            }
        }
        return Array(Set(recognised).union(commonCodes)).sorted {
            displayName(for: $0) < displayName(for: $1)
        }
    }()
}
