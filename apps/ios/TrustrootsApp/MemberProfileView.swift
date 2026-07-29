import SwiftUI

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
    @State private var showAllContacts = false
    @State private var showAllExperiences = false
    @State private var errorMessage: String?
    @State private var isLoading = false
    @State private var isBlocked = false
    @State private var isUpdatingBlock = false
    @State private var showBlockConfirmation = false
    @State private var showReportMember = false
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
                            HStack(alignment: .bottom, spacing: 16) {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(profile.displayName)
                                        .font(.title.bold())
                                        .foregroundStyle(.white)
                                    Text("@\(profile.username)")
                                        .font(.subheadline)
                                        .foregroundStyle(.white.opacity(0.82))
                                    if let tagline = profile.tagline, !tagline.isEmpty {
                                        Text(tagline.plainText)
                                            .font(.subheadline.weight(.medium))
                                            .foregroundStyle(.white)
                                            .lineLimit(2)
                                    }
                                }
                                Spacer(minLength: 0)
                                MemberAvatarView(
                                    memberID: profile.id,
                                    displayName: profile.displayName,
                                    serverURLString: session.serverURLString,
                                    size: 112
                                )
                                .overlay {
                                    Circle().stroke(.white.opacity(0.9), lineWidth: 2)
                                }
                                .shadow(color: .black.opacity(0.28), radius: 8, y: 3)
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, 76)
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
                            .overlay(alignment: .topLeading) {
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
                                    .padding(.leading, 16)
                                    .padding(.top, 52)
                                }
                            }

                            if let editProfile {
                                Button(action: editProfile) {
                                    Label("Edit profile", systemImage: "pencil")
                                        .font(.subheadline.weight(.semibold))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 11)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(TrustrootsPalette.green)
                            }

                            if !isOwnProfile(profile), !isBlocked, let memberID = profile.id {
                                NavigationLink {
                                    ConversationView(
                                        otherMember: MiniMember(
                                            id: memberID,
                                            username: profile.username,
                                            displayName: profile.displayName
                                        ),
                                        session: session
                                    )
                                } label: {
                                    VStack(spacing: 3) {
                                        Label("Message", systemImage: "bubble.left.and.bubble.right.fill")
                                            .font(.subheadline.weight(.semibold))
                                        Text("Open or start a conversation")
                                            .font(.caption)
                                            .opacity(0.85)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(TrustrootsPalette.green)
                                .accessibilityLabel("Open or start a conversation with \(profile.displayName)")
                            }

                            ProfileActivityView(
                                seen: profile.seen,
                                replyRate: profile.replyRate,
                                replyTime: profile.replyTime
                            )

                            if profile.locationLiving != nil || profile.locationFrom != nil {
                                VStack(alignment: .leading, spacing: 10) {
                                    if let living = profile.locationLiving, !living.isEmpty {
                                        Button {
                                            openOnSearchMap(living)
                                        } label: {
                                            Label("Lives in \(living)", systemImage: "house")
                                        }
                                    }
                                    if let from = profile.locationFrom, !from.isEmpty {
                                        Button {
                                            openOnSearchMap(from)
                                        } label: {
                                            Label("From \(from)", systemImage: "mappin.and.ellipse")
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(16)
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }

                            if let description = profile.description?.plainText, !description.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("About me")
                                        .font(.headline)
                                    Text(description)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            if let accommodationOffer {
                                HostingDetailsView(
                                    status: accommodationOffer.status,
                                    description: accommodationOffer.description,
                                    noOfferDescription: accommodationOffer.noOfferDescription,
                                    maxGuests: accommodationOffer.maxGuests
                                )
                            }

                            if let languages = profile.languages, !languages.isEmpty {
                                if languages.count >= 5 {
                                    Text(languages.map { TrustrootsLanguage.displayName(for: $0) }.joined(separator: " · "))
                                        .foregroundStyle(.secondary)
                                } else {
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Languages")
                                            .font(.headline)
                                        Text(languages.map { TrustrootsLanguage.displayName(for: $0) }.joined(separator: " · "))
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }

                            if let memberships = profile.member, !memberships.isEmpty {
                                circlesSection(memberships.map(\.tribe))
                            }

                            if !contacts.isEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Contacts")
                                        .font(.headline)
                                    ForEach(showAllContacts ? contacts : Array(contacts.prefix(6))) { contact in
                                        if let contactUsername = contact.user.username {
                                            NavigationLink {
                                                MemberProfileView(session: session, username: contactUsername)
                                            } label: {
                                                profileContactRow(contact)
                                            }
                                        } else {
                                            profileContactRow(contact)
                                        }
                                    }
                                    if contacts.count > 6 {
                                        profileSectionToggle(
                                            isExpanded: $showAllContacts,
                                            hiddenCount: contacts.count - 6,
                                            noun: "contacts"
                                        )
                                    }
                                }
                            }

                            if !experiences.isEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Experiences")
                                        .font(.headline)
                                    ExperienceOverview(experiences: experiences)
                                    ForEach(showAllExperiences ? experiences : Array(experiences.prefix(6))) { experience in
                                        ExperienceRow(experience: experience, session: session)
                                    }
                                    if experiences.count > 6 {
                                        profileSectionToggle(
                                            isExpanded: $showAllExperiences,
                                            hiddenCount: experiences.count - 6,
                                            noun: "experiences"
                                        )
                                    }
                                }
                            }

                            if !isOwnProfile(profile) {
                                memberSafetySection(profile)
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
            .ignoresSafeArea(edges: .top)
            .toolbar(.hidden, for: .navigationBar)
            .onAppear {
                NotificationCenter.default.post(name: .trustrootsProfileDetailVisibility, object: true)
            }
            .onDisappear {
                NotificationCenter.default.post(name: .trustrootsProfileDetailVisibility, object: false)
            }
            .onReceive(NotificationCenter.default.publisher(for: .trustrootsReturnToMap)) { _ in
                dismiss()
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

    private func memberSafetySection(_ profile: MemberProfile) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider()

            if isBlocked {
                Text("You have blocked \(profile.displayName).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 18) {
                Button {
                    showReportMember = true
                } label: {
                    Label("Report member", systemImage: "flag")
                }
                .foregroundStyle(.secondary)

                Button(role: isBlocked ? nil : .destructive) {
                    showBlockConfirmation = true
                } label: {
                    if isUpdatingBlock {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label(
                            isBlocked ? "Unblock" : "Block",
                            systemImage: isBlocked ? "hand.raised.slash" : "hand.raised"
                        )
                    }
                }
                .foregroundStyle(isBlocked ? Color.secondary : Color.red)
                .disabled(isUpdatingBlock)

                Spacer()
            }
            .font(.footnote)
            .buttonStyle(.plain)
            .frame(minHeight: 32)

            if let safetyErrorMessage {
                Text(safetyErrorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 2)
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

    private func profileContactRow(_ contact: TrustrootsContact) -> some View {
        HStack(spacing: 9) {
            MemberAvatarView(
                memberID: contact.user.id,
                displayName: contact.user.displayName ?? contact.user.username ?? "Trustroots member",
                serverURLString: session.serverURLString,
                size: 34
            )
            Text(contact.user.displayName ?? contact.user.username ?? "Trustroots member")
                .foregroundStyle(.primary)
            Spacer()
        }
    }

    private func profileSectionToggle(
        isExpanded: Binding<Bool>,
        hiddenCount: Int,
        noun: String
    ) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                isExpanded.wrappedValue.toggle()
            }
        } label: {
            HStack {
                Text(isExpanded.wrappedValue ? "Show fewer" : "More \(noun) (\(hiddenCount))")
                Spacer()
                Image(systemName: isExpanded.wrappedValue ? "chevron.up" : "chevron.down")
            }
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
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
                        Section("Reporting") {
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
                            Text("Please include enough detail for the support team to understand and investigate.")
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
            .navigationTitle("Report member")
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

private struct ProfileActivityView: View {
    let seen: Date?
    let replyRate: String?
    let replyTime: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Activity")
                .font(.headline)

            activityRow(
                systemImage: "clock.arrow.circlepath",
                title: "Last login",
                value: seen?.formatted(.relative(presentation: .named)) ?? "Long ago"
            )
            activityRow(
                systemImage: "arrowshape.turn.up.left.fill",
                title: "Reply rate",
                value: nonEmpty(replyRate) ?? "Not available yet"
            )
            if let replyTime = nonEmpty(replyTime) {
                activityRow(
                    systemImage: "timer",
                    title: "Usually replies",
                    value: "Within \(replyTime)"
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(TrustrootsPalette.paleGreen)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func activityRow(
        systemImage: String,
        title: String,
        value: String
    ) -> some View {
        HStack(spacing: 11) {
            Image(systemName: systemImage)
                .foregroundStyle(TrustrootsPalette.darkGreen)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(.semibold))
            }
            Spacer()
        }
    }

    private func nonEmpty(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let trimmed, !trimmed.isEmpty else { return nil }
        return trimmed
    }
}

private struct ExperienceOverview: View {
    let experiences: [MemberExperience]

    private var total: Int { experiences.count }

    private func percentage(_ matches: (MemberExperience) -> Bool) -> Int {
        guard total > 0 else { return 0 }
        return Int(Double(experiences.filter(matches).count) / Double(total) * 100)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(total == 1 ? "1 member shared an experience." : "\(total) members shared their experiences.")
                .font(.subheadline.weight(.medium))

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 8),
                    GridItem(.flexible(), spacing: 8),
                ],
                spacing: 8
            ) {
                statistic("Recommend", percentage { $0.recommend == "yes" }, "hand.thumbsup.fill")
                statistic("Met", percentage { $0.interactions?.met == true }, "person.2.fill")
                statistic("Hosted them", percentage { $0.interactions?.guest == true }, "house.fill")
                statistic("Hosted by them", percentage { $0.interactions?.host == true }, "sofa.fill")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(TrustrootsPalette.paleGreen)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func statistic(_ label: String, _ value: Int, _ systemImage: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(TrustrootsPalette.darkGreen)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(value)%")
                    .font(.headline.monospacedDigit())
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(9)
        .background(Color(.systemBackground).opacity(0.82))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct HostingDetailsView: View {
    let status: String?
    let description: String?
    let noOfferDescription: String?
    let maxGuests: Int?
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

private struct ExperienceRow: View {
    let experience: MemberExperience
    @ObservedObject var session: MemberSessionStore

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            experiencePersonRow(
                member: experience.userFrom,
                label: "Wrote about this member",
                feedback: experience.feedbackPublic,
                recommend: experience.recommend
            )
            if let response = experience.response,
               let feedback = response.feedbackPublic?.plainText,
               !feedback.isEmpty {
                Divider()
                experiencePersonRow(
                    member: experience.userTo,
                    label: "Their response",
                    feedback: feedback,
                    recommend: response.recommend
                )
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder
    private func experiencePersonRow(
        member: MiniMember,
        label: String,
        feedback: String?,
        recommend: String?
    ) -> some View {
        HStack(alignment: .top, spacing: 9) {
            if let username = member.username {
                NavigationLink {
                    MemberProfileView(session: session, username: username)
                } label: {
                    MemberAvatarView(
                        memberID: member.id,
                        displayName: member.displayName ?? username,
                        serverURLString: session.serverURLString,
                        size: 38
                    )
                }
            } else {
                MemberAvatarView(
                    memberID: member.id,
                    displayName: member.displayName ?? "Trustroots member",
                    serverURLString: session.serverURLString,
                    size: 38
                )
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    if let username = member.username {
                        NavigationLink {
                            MemberProfileView(session: session, username: username)
                        } label: {
                            Text(member.displayName ?? username)
                                .font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                    } else {
                        Text(member.displayName ?? "Trustroots member")
                            .font(.subheadline.weight(.semibold))
                    }
                    Spacer()
                    if let recommend {
                        Text(recommend == "yes" ? "Recommends" : recommend == "no" ? "Does not recommend" : "Experience")
                            .font(.caption)
                            .foregroundStyle(recommend == "yes" ? TrustrootsPalette.darkGreen : .secondary)
                    }
                }
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let feedback = feedback?.plainText, !feedback.isEmpty {
                    Text(feedback)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(4)
                }
            }
        }
    }
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: [.regularExpression, .caseInsensitive])
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
