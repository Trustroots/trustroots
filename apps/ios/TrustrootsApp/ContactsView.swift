import SwiftUI

struct ContactsView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var contacts: [TrustrootsContact] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && contacts.isEmpty {
                    ProgressView("Loading contacts…")
                } else if let errorMessage {
                    ContentUnavailableView("Contacts unavailable", systemImage: "person.crop.circle.badge.exclamationmark", description: Text(errorMessage))
                } else if contacts.isEmpty {
                    ContentUnavailableView(
                        "No contacts yet",
                        systemImage: "person.2",
                        description: Text("People you connect with on Trustroots will appear here.")
                    )
                } else {
                    List(contacts) { contact in
                        if let username = contact.user.username {
                            NavigationLink {
                                MemberProfileView(session: session, username: username)
                            } label: {
                                contactRow(contact)
                            }
                        } else {
                            contactRow(contact)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .task { await loadContacts() }
        }
    }

    private func contactRow(_ contact: TrustrootsContact) -> some View {
        HStack(spacing: 12) {
            MemberAvatarView(
                memberID: contact.user.id,
                displayName: contact.user.displayName ?? contact.user.username ?? "Trustroots member",
                serverURLString: session.serverURLString,
                size: 48
            )
            VStack(alignment: .leading, spacing: 3) {
                Text(contact.user.displayName ?? contact.user.username ?? "Trustroots member")
                    .font(.headline)
                if let username = contact.user.username {
                    Text("@\(username)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if !contact.confirmed {
                    Text("Awaiting confirmation")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
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
            contacts = try await api.contacts(serverURLString: session.serverURLString, userID: userID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
