import Foundation

@MainActor
final class MemberSessionStore: ObservableObject {
    private static let persistedMemberKey = "trustroots.signedInMember"

    @Published private(set) var member: SignedInMember?
    @Published private(set) var isSigningIn = false
    @Published var errorMessage: String?
    @Published var serverURLString: String

    private let api: TrustrootsAPI
    private let credentialStore: SessionCredentialStore

    init(
        api: TrustrootsAPI = TrustrootsAPI(),
        serverURLString: String? = nil,
        credentialStore: SessionCredentialStore = SessionCredentialStore()
    ) {
        self.api = api
        self.credentialStore = credentialStore
        self.serverURLString = serverURLString
            ?? TrustrootsAPIConfiguration.productionURLString
        let storedCredentials = credentialStore.load()
        self.member = storedCredentials == nil ? nil : Self.loadPersistedMember()
        updateCacheScope()
    }

    func signIn(usernameOrEmail: String, password: String) async {
        guard !usernameOrEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            errorMessage = "Enter both your username or email address and password."
            return
        }

        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let websiteSession = try await api.signIn(
                serverURLString: serverURLString,
                usernameOrEmail: usernameOrEmail,
                password: password
            )
            guard credentialStore.save(websiteSession.credentials) else {
                throw TrustrootsAPIError.serverMessage("Secure credential storage is unavailable.")
            }
            member = websiteSession.member
            if let encodedMember = try? JSONEncoder().encode(websiteSession.member) {
                UserDefaults.standard.set(encodedMember, forKey: Self.persistedMemberKey)
            }
            updateCacheScope()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        await api.signOut(serverURLString: serverURLString)
        credentialStore.delete()
        member = nil
        errorMessage = nil
        UserDefaults.standard.removeObject(forKey: Self.persistedMemberKey)
        UserDefaults.standard.removeObject(forKey: OfflineResponseCache.scopeDefaultsKey)
        await OfflineResponseCache.shared.clear()
        OfflineAvailability.shared.showLiveData()
    }

    func invalidateSession() {
        member = nil
        credentialStore.delete()
        errorMessage = "Your session expired or is no longer valid. Please sign in again."
        UserDefaults.standard.removeObject(forKey: Self.persistedMemberKey)
        UserDefaults.standard.removeObject(forKey: OfflineResponseCache.scopeDefaultsKey)
        Task { await OfflineResponseCache.shared.clear() }
        OfflineAvailability.shared.showLiveData()
    }

    func updateAccountDetails(email: String?, newsletter: Bool?) {
        guard let member else { return }
        let updatedMember = SignedInMember(
            username: member.username,
            displayName: member.displayName,
            isPublic: member.isPublic,
            email: email ?? member.email,
            newsletter: newsletter ?? member.newsletter
        )
        self.member = updatedMember
        if let encodedMember = try? JSONEncoder().encode(updatedMember) {
            UserDefaults.standard.set(encodedMember, forKey: Self.persistedMemberKey)
        }
    }

    private static func loadPersistedMember() -> SignedInMember? {
        guard let data = UserDefaults.standard.data(forKey: persistedMemberKey) else {
            return nil
        }
        return try? JSONDecoder().decode(SignedInMember.self, from: data)
    }

    private func updateCacheScope() {
        guard let member else {
            UserDefaults.standard.removeObject(forKey: OfflineResponseCache.scopeDefaultsKey)
            return
        }
        let server = TrustrootsAPIConfiguration(baseURLString: serverURLString)?.normalizedURLString ?? serverURLString
        UserDefaults.standard.set("\(server)|\(member.username.lowercased())", forKey: OfflineResponseCache.scopeDefaultsKey)
    }
}
