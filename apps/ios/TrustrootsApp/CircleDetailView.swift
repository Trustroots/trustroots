import MapKit
import SwiftUI

struct CircleDetailView: View {
    @ObservedObject var session: MemberSessionStore
    let circle: TrustrootsCircle

    @State private var contacts: [MiniMember] = []
    @State private var positiveExperienceMembers: [MiniMember] = []
    @State private var otherMembers: [MiniMember] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                circleSummary

                if isLoading && contacts.isEmpty && positiveExperienceMembers.isEmpty && otherMembers.isEmpty {
                    ProgressView("Finding circle members…")
                        .frame(maxWidth: .infinity, minHeight: 180)
                } else {
                    if !contacts.isEmpty {
                        memberSection(
                            title: "Your contacts in this circle",
                            subtitle: "People you already know on Trustroots",
                            members: contacts
                        )
                    }

                    if !positiveExperienceMembers.isEmpty {
                        memberSection(
                            title: "People who recommend you",
                            subtitle: "Members of this circle who left you a positive experience",
                            members: positiveExperienceMembers
                        )
                    }

                    if !otherMembers.isEmpty {
                        memberSection(
                            title: "Other active members",
                            subtitle: "A small selection of members with current offers",
                            members: otherMembers
                        )
                    }

                    if contacts.isEmpty && positiveExperienceMembers.isEmpty && otherMembers.isEmpty {
                        ContentUnavailableView(
                            "No members to show yet",
                            systemImage: "person.2",
                            description: Text("Try again later to discover people in this circle.")
                        )
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Button {
                    NotificationCenter.default.post(
                        name: .trustrootsOpenWebsite,
                        object: TrustrootsWebsiteLink(
                            url: URL(string: "https://wiki.trustroots.org")!,
                            title: "Trustroots Wiki"
                        )
                    )
                } label: {
                    Label("Explore this community on the Trustroots Wiki", systemImage: "book.closed")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(TrustrootsPalette.darkGreen)
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(TrustrootsPalette.paleGreen)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .padding(16)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadMembers() }
    }

    private var circleSummary: some View {
        CircleHero(circle: circle, serverURLString: session.serverURLString)
            .frame(maxWidth: .infinity)
            .frame(height: 230)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func memberSection(title: String, subtitle: String, members: [MiniMember]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
            ForEach(members, id: \.stableID) { member in
                if let username = member.username {
                    NavigationLink {
                        MemberProfileView(session: session, username: username)
                    } label: {
                        memberRow(member)
                    }
                    .buttonStyle(.plain)
                } else {
                    memberRow(member)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(TrustrootsPalette.paleGreen.opacity(0.62))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func memberRow(_ member: MiniMember) -> some View {
        HStack(spacing: 11) {
            MemberAvatarView(
                memberID: member.id,
                displayName: member.displayName ?? member.username ?? "Trustroots member",
                serverURLString: session.serverURLString,
                size: 46
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(member.displayName ?? member.username ?? "Trustroots member")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                if let username = member.username {
                    Text("@\(username)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 3)
    }

    private func loadMembers() async {
        guard !isLoading, let ownUsername = session.member?.username else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let ownProfile = try await api.profile(serverURLString: session.serverURLString, username: ownUsername)
            if let ownID = ownProfile.id {
                async let loadedContacts = api.contacts(serverURLString: session.serverURLString, userID: ownID)
                async let loadedExperiences = api.experiences(serverURLString: session.serverURLString, userID: ownID)
                let (contactResults, experienceResults) = try await (loadedContacts, loadedExperiences)
                contacts = await members(in: contactResults.map(\.user))

                let contactIDs = Set(contacts.compactMap(\.id))
                let positiveCandidates = experienceResults
                    .filter { $0.recommend == "yes" }
                    .map(\.userFrom)
                    .filter { member in
                        guard let id = member.id else { return true }
                        return !contactIDs.contains(id)
                    }
                positiveExperienceMembers = await members(in: positiveCandidates)
            }
            otherMembers = try await activeMembers()
        } catch {
            errorMessage = "Some circle members could not be loaded."
        }
    }

    private func members(in candidates: [MiniMember]) async -> [MiniMember] {
        var results: [MiniMember] = []
        var seen = Set<String>()
        for candidate in candidates.prefix(40) {
            let candidateID = candidate.id ?? candidate.username ?? candidate.displayName ?? ""
            guard seen.insert(candidateID).inserted else { continue }
            guard let username = candidate.username,
                  let profile = try? await api.profile(serverURLString: session.serverURLString, username: username),
                  profile.member?.contains(where: { $0.tribe.id == circle.id }) == true else {
                continue
            }
            results.append(candidate)
            if results.count == 20 { break }
        }
        return results
    }

    private func activeMembers() async throws -> [MiniMember] {
        let regions = [
            MKCoordinateRegion(center: .init(latitude: 47, longitude: 9), span: .init(latitudeDelta: 55, longitudeDelta: 80)),
            MKCoordinateRegion(center: .init(latitude: 39, longitude: -88), span: .init(latitudeDelta: 48, longitudeDelta: 85)),
            MKCoordinateRegion(center: .init(latitude: -27, longitude: 135), span: .init(latitudeDelta: 55, longitudeDelta: 90)),
        ]

        var offerIDs: [String] = []
        for region in regions {
            let offers = (try? await api.searchOffers(
                serverURLString: session.serverURLString,
                in: region,
                types: ["host"],
                tribeIDs: [circle.id]
            )) ?? []
            offerIDs.append(contentsOf: offers.map(\.id))
        }

        var seen = Set<String>()
        var members: [MiniMember] = []
        let familiarMemberIDs = Set((contacts + positiveExperienceMembers).compactMap(\.id))
        for offerID in offerIDs where seen.insert(offerID).inserted {
            guard members.count < 8,
                  let offer = try? await api.offer(serverURLString: session.serverURLString, offerID: offerID),
                  let memberID = offer.user.id,
                  !familiarMemberIDs.contains(memberID),
                  !members.contains(where: { $0.id == memberID }) else {
                continue
            }
            members.append(offer.user)
        }
        return members
    }
}

private struct CircleHero: View {
    let circle: TrustrootsCircle
    let serverURLString: String

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if circle.image,
               let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString),
               let url = URL(string: "\(configuration.normalizedURLString)/uploads-circle/\(circle.slug)/742x496.jpg") {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        TrustrootsPalette.darkGreen
                    }
                }
            } else {
                LinearGradient(
                    colors: [TrustrootsPalette.green, TrustrootsPalette.darkGreen],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }

            LinearGradient(
                colors: [.black.opacity(0.05), .black.opacity(0.78)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 5) {
                Text(circle.label)
                    .font(.title2.bold())
                Text("\(circle.count) members")
                    .font(.subheadline.weight(.semibold))
                if let description = circle.description?.plainText, !description.isEmpty {
                    Text(description)
                        .font(.subheadline)
                        .lineLimit(4)
                }
            }
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.7), radius: 2, y: 1)
            .padding(16)
        }
    }
}

private extension MiniMember {
    var stableID: String { id ?? username ?? displayName ?? UUID().uuidString }
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }
}
