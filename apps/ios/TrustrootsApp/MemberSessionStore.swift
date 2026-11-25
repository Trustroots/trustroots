import Foundation

@MainActor
final class MemberSessionStore: ObservableObject {
    private static let persistedMemberKey = "trustroots.signedInMember"
    private static let persistedServerKey = "trustroots.apiServerURL"

    @Published private(set) var member: SignedInMember?
    @Published private(set) var isSigningIn = false
    @Published var errorMessage: String?
    @Published var serverURLString: String {
        didSet {
            if serverURLString != oldValue { nostrIdentity.pause() }
        }
    }

    private let nostrIdentity: NostrIdentityManager
    private let api: TrustrootsAPI
    private let credentialStore: MobileCredentialStoring

    init(
        api: TrustrootsAPI = TrustrootsAPI(),
        serverURLString: String? = nil,
        credentialStore: MobileCredentialStoring = MobileCredentialStore(),
        nostrIdentity: NostrIdentityManager? = nil
    ) {
        self.nostrIdentity = nostrIdentity ?? .shared
        self.api = api
        self.credentialStore = credentialStore
        let defaults = UserDefaults.standard
        let persistedServerURL = defaults.string(forKey: Self.persistedServerKey)
        let retiredDevelopmentServers = [
            "http://127.0.0.1:3001",
            "https://cat.trustroots.org",
            "https://pr2777.test.trustroots.org",
        ]
        let usesRetiredServer = serverURLString == nil
            && persistedServerURL.map(retiredDevelopmentServers.contains) == true
        self.serverURLString = serverURLString
            ?? (usesRetiredServer ? nil : persistedServerURL)
            ?? TrustrootsAPIConfiguration.buildDefaultURLString
        if usesRetiredServer {
            // Credentials issued by a preview server must stay off the replacement server.
            credentialStore.delete()
            defaults.removeObject(forKey: Self.persistedMemberKey)
            defaults.removeObject(forKey: Self.persistedServerKey)
        }
        self.member = credentialStore.load() == nil ? nil : Self.loadPersistedMember()
        updateCacheScope()
    }

    func signIn(usernameOrEmail: String, password: String) async {
        guard !usernameOrEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            errorMessage = "Enter both your username or email address and password."
            return
        }

        nostrIdentity.pause()
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
            UserDefaults.standard.set(serverURLString, forKey: Self.persistedServerKey)
            if let encodedMember = try? JSONEncoder().encode(mobileSession.member) {
                UserDefaults.standard.set(encodedMember, forKey: Self.persistedMemberKey)
            }
            updateCacheScope()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        nostrIdentity.pause()
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
        nostrIdentity.pause()
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
            nostrIdentity.pause()
            UserDefaults.standard.removeObject(forKey: OfflineResponseCache.scopeDefaultsKey)
            return
        }
        nostrIdentity.activate(serverURLString: serverURLString, username: member.username)
        let server = TrustrootsAPIConfiguration(baseURLString: serverURLString)?.normalizedURLString ?? serverURLString
        UserDefaults.standard.set("\(server)|\(member.username.lowercased())", forKey: OfflineResponseCache.scopeDefaultsKey)
    }
}
