import SwiftUI

struct MemberProfileView: View {
    @ObservedObject var session: MemberSessionStore
    let username: String?
    let editProfile: (() -> Void)?
    let openCircles: (() -> Void)?
    @State private var profile: MemberProfile?
    @State private var contacts: [TrustrootsContact] = []
    @State private var experiences: [MemberExperience] = []
    @State private var errorMessage: String?
    @State private var isLoading = false

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
                        Button {
                            NotificationCenter.default.post(name: .trustrootsOpenAPIDiagnostics, object: nil)
                        } label: {
                            Label("Open API diagnostics", systemImage: "stethoscope")
                        }
                        .buttonStyle(.bordered)
                    }
                } else if let profile {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 22) {
                            HStack(spacing: 18) {
                                MemberAvatarView(
                                    memberID: profile.id,
                                    displayName: profile.displayName,
                                    serverURLString: session.serverURLString,
                                    size: 92
                                )
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(profile.displayName)
                                        .font(.title.bold())
                                    Text("@\(profile.username)")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                    if let tagline = profile.tagline, !tagline.isEmpty {
                                        Text(tagline.plainText)
                                            .font(.subheadline.weight(.medium))
                                            .foregroundStyle(.primary)
                                    }
                                }
                                Spacer(minLength: 0)
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
                                    ForEach(contacts.prefix(6)) { contact in
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
                                }
                            }

                            if !experiences.isEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Experiences")
                                        .font(.headline)
                                    ForEach(experiences.prefix(6)) { experience in
                                        ExperienceRow(experience: experience, session: session)
                                    }
                                }
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
    }

    private var shouldOpenCanonicalOwnProfile: Bool {
        guard editProfile == nil,
              let username,
              let signedInUsername = session.member?.username else { return false }
        return username.caseInsensitiveCompare(signedInUsername) == .orderedSame
    }

    private func loadProfile() async {
        guard !isLoading, let username = username ?? session.member?.username else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let loadedProfile = try await api.profile(serverURLString: session.serverURLString, username: username)
            profile = loadedProfile
            if let userID = loadedProfile.id {
                async let loadedContacts = api.contacts(serverURLString: session.serverURLString, userID: userID)
                async let loadedExperiences = api.experiences(serverURLString: session.serverURLString, userID: userID)
                contacts = (try? await loadedContacts) ?? []
                experiences = (try? await loadedExperiences) ?? []
            }
        } catch {
            errorMessage = error.localizedDescription
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
