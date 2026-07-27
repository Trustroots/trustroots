import Foundation

@MainActor
final class MemberSessionStore: ObservableObject {
    private static let persistedMemberKey = "trustroots.signedInMember"

    @Published private(set) var member: SignedInMember?
    @Published private(set) var isSigningIn = false
    @Published var errorMessage: String?
    @Published var serverURLString: String

    private let api: TrustrootsAPI
    private let credentialStore: MobileCredentialStore

    init(
        api: TrustrootsAPI = TrustrootsAPI(),
        serverURLString: String? = nil,
        credentialStore: MobileCredentialStore = MobileCredentialStore()
    ) {
        self.api = api
        self.credentialStore = credentialStore
        let persistedServerURL = UserDefaults.standard.string(forKey: "trustroots.apiServerURL")
        let retiredDevelopmentServers = [
            "http://127.0.0.1:3001",
            "https://cat.trustroots.org",
        ]
        self.serverURLString = serverURLString
            ?? (persistedServerURL.map(retiredDevelopmentServers.contains) == true
                ? TrustrootsAPIConfiguration.buildDefaultURLString
                : persistedServerURL ?? TrustrootsAPIConfiguration.buildDefaultURLString)
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
            let mobileSession = try await api.signIn(
                serverURLString: serverURLString,
                usernameOrEmail: usernameOrEmail,
                password: password
            )
            guard credentialStore.save(mobileSession.credentials) else {
                throw TrustrootsAPIError.serverMessage("Secure credential storage is unavailable.")
            }
            member = mobileSession.member
            UserDefaults.standard.set(serverURLString, forKey: "trustroots.apiServerURL")
            if let encodedMember = try? JSONEncoder().encode(mobileSession.member) {
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
