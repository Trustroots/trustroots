import MapKit
import SwiftUI
import TrustrootsShared

struct CircleDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var session: MemberSessionStore
    let circle: TrustrootsCircle

    @State private var contacts: [MiniMember] = []
    @State private var positiveExperienceMembers: [MiniMember] = []
    @State private var otherMembers: [MiniMember] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var profileUsername: String?

    private let api = TrustrootsAPI()

    var body: some View {
        ComposeCircleDetail(
            circle: circle,
            contacts: contacts,
            recommenders: positiveExperienceMembers,
            active: otherMembers,
            isLoading: isLoading,
            error: errorMessage,
            serverURLString: session.serverURLString,
            onBack: { dismiss() },
            onProfile: { username in
                if profileUsername == nil { profileUsername = username }
            },
            onRetry: { Task { await loadMembers() } },
            onWiki: openWiki
        )
        .navigationDestination(isPresented: Binding(
            get: { profileUsername != nil },
            set: { if !$0 { profileUsername = nil } }
        )) {
            if let profileUsername {
                MemberProfileView(session: session, username: profileUsername)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await loadMembers() }
    }

    private func openWiki() {
        NotificationCenter.default.post(
            name: .trustrootsOpenWebsite,
            object: TrustrootsWebsiteLink(
                url: URL(string: "https://wiki.trustroots.org")!,
                title: "Trustroots Wiki"
            )
        )
    }

    private func loadMembers() async {
        guard !isLoading, let ownUsername = session.member?.username else { return }
        let cacheKey = "\(session.serverURLString)|\(ownUsername)|\(circle.id)"
        if let cached = await CircleMemberCache.shared.snapshot(for: cacheKey) {
            contacts = cached.contacts
            positiveExperienceMembers = cached.positiveExperienceMembers
            otherMembers = cached.otherMembers
            return
        }

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
            await CircleMemberCache.shared.store(
                CircleMemberSnapshot(
                    contacts: contacts,
                    positiveExperienceMembers: positiveExperienceMembers,
                    otherMembers: otherMembers
                ),
                for: cacheKey
            )
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

private struct CircleMemberSnapshot {
    let contacts: [MiniMember]
    let positiveExperienceMembers: [MiniMember]
    let otherMembers: [MiniMember]
}

private actor CircleMemberCache {
    static let shared = CircleMemberCache()

    private struct Entry {
        let snapshot: CircleMemberSnapshot
        let savedAt: Date
    }

    private var entries: [String: Entry] = [:]
    private let lifetime: TimeInterval = 15 * 60

    func snapshot(for key: String) -> CircleMemberSnapshot? {
        guard let entry = entries[key],
              Date().timeIntervalSince(entry.savedAt) < lifetime else {
            entries.removeValue(forKey: key)
            return nil
        }
        return entry.snapshot
    }

    func store(_ snapshot: CircleMemberSnapshot, for key: String) {
        entries[key] = Entry(snapshot: snapshot, savedAt: .now)
    }
}

@MainActor
private struct ComposeCircleDetail: UIViewControllerRepresentable {
    let circle: TrustrootsCircle
    let contacts: [MiniMember]
    let recommenders: [MiniMember]
    let active: [MiniMember]
    let isLoading: Bool
    let error: String?
    let serverURLString: String
    let onBack: () -> Void
    let onProfile: (String) -> Void
    let onRetry: () -> Void
    let onWiki: () -> Void

    final class Coordinator {
        let state = MemberCircleDetailState()
        var view: ComposeCircleDetail?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MainViewControllerKt.MemberCircleDetailViewController(
            state: coordinator.state,
            onBack: { [weak coordinator] in coordinator?.view?.onBack() },
            onProfile: { [weak coordinator] in coordinator?.view?.onProfile($0) },
            onRetry: { [weak coordinator] in coordinator?.view?.onRetry() },
            onWiki: { [weak coordinator] in coordinator?.view?.onWiki() },
            createArtwork: { [weak coordinator] in
                guard let view = coordinator?.view else { return UIViewController() }
                return UIHostingController(rootView: CircleDetailArtwork(
                    circle: view.circle,
                    serverURLString: view.serverURLString
                ))
            },
            createAvatar: { [weak coordinator] member in
                guard let view = coordinator?.view else { return UIViewController() }
                return makeSharedMemberAvatarController(
                    memberID: member.memberId,
                    name: member.name,
                    serverURLString: view.serverURLString
                )
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.view = self
        coordinator.state.update(
            name: circle.label,
            memberCount: "\(circle.count.formatted()) members",
            description: circle.description?.plainText ?? "",
            contacts: present(contacts),
            recommenders: present(recommenders),
            active: present(active),
            isLoading: isLoading,
            error: error
        )
    }

    private func present(_ members: [MiniMember]) -> [CircleDetailMember] {
        members.enumerated().map { index, member in
            let identity = MemberIdentityText(member: member)
            return CircleDetailMember(
                id: member.id ?? member.username ?? String(index),
                memberId: member.id,
                username: member.username,
                name: identity.primary,
                handle: identity.secondary
            )
        }
    }
}

private struct CircleDetailArtwork: View {
    let circle: TrustrootsCircle
    let serverURLString: String

    var body: some View {
        GeometryReader { geometry in
            Group {
                if circle.image,
                   let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString),
                   let url = URL(string: "\(configuration.normalizedURLString)/uploads-circle/\(circle.slug)/742x496.jpg") {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            fallback
                        }
                    }
                } else {
                    fallback
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .clipped()
        }
    }

    private var fallback: some View {
        LinearGradient(
            colors: [TrustrootsPalette.green, TrustrootsPalette.darkGreen],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay {
            Text(circle.label.prefix(1).uppercased())
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }
}
