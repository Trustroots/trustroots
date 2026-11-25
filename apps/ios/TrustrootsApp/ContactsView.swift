import SwiftUI
import TrustrootsShared

struct ContactsView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var contacts: [TrustrootsContact] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var profiles: [String] = []

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack(path: $profiles) {
            ComposeContacts(
                contacts: contacts.map(presentationContact),
                isLoading: isLoading,
                error: errorMessage,
                serverURLString: session.serverURLString,
                onOpen: { username in
                    if profiles.isEmpty { profiles.append(username) }
                },
                onRetry: { Task { await loadContacts() } }
            )
            .navigationDestination(for: String.self) { username in
                MemberProfileView(session: session, username: username)
            }
            .task { await loadContacts() }
        }
    }

    private func presentationContact(_ contact: TrustrootsContact) -> MemberContact {
        let identity = MemberIdentityText(member: contact.user)
        return MemberContact(
            id: contact.id,
            memberId: contact.user.id,
            username: contact.user.username,
            name: identity.primary,
            handle: identity.secondary,
            pending: !contact.confirmed
        )
    }

    private func loadContacts() async {
        guard !isLoading, let username = session.member?.username else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let profile = try await api.profile(serverURLString: session.serverURLString, username: username)
            guard let userID = profile.id else {
                throw TrustrootsAPIError.invalidResponse
            }
            let loaded = try await api.contacts(serverURLString: session.serverURLString, userID: userID)
            if !Task.isCancelled { contacts = loaded }
        } catch {
            if !Task.isCancelled { errorMessage = error.localizedDescription }
        }
    }
}

@MainActor
private struct ComposeContacts: UIViewControllerRepresentable {
    let contacts: [MemberContact]
    let isLoading: Bool
    let error: String?
    let serverURLString: String
    let onOpen: (String) -> Void
    let onRetry: () -> Void

    final class Coordinator {
        let state = MemberContactsState()
        var onOpen: ((String) -> Void)?
        var onRetry: (() -> Void)?
        var serverURLString = ""
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MainViewControllerKt.MemberContactsViewController(
            state: coordinator.state,
            onOpen: { [weak coordinator] username in coordinator?.onOpen?(username) },
            onRetry: { [weak coordinator] in coordinator?.onRetry?() },
            createAvatar: { [weak coordinator] contact in
                guard let coordinator else { return UIViewController() }
                return makeSharedMemberAvatarController(
                    memberID: contact.memberId,
                    name: contact.name,
                    serverURLString: coordinator.serverURLString
                )
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onOpen = onOpen
        coordinator.onRetry = onRetry
        coordinator.serverURLString = serverURLString
        coordinator.state.update(contacts: contacts, isLoading: isLoading, error: error)
    }
}
