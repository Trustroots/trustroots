import Foundation

@MainActor
final class MemberSessionStore: ObservableObject {
    private static let persistedMemberKey = "trustroots.signedInMember"
    private static let persistedServerKey = "trustroots.apiServerURL"

    @Published private(set) var member: SignedInMember?
    @Published private(set) var isSigningIn = false
    @Published private(set) var requiresBrowserSignIn = false
    @Published private(set) var browserSignInError: String?
    @Published var errorMessage: String?
    @Published var serverURLString: String {
        didSet {
            if serverURLString != oldValue {
                nostrIdentity.pause()
                if requiresBrowserSignIn { errorMessage = nil }
                requiresBrowserSignIn = false
                browserSignInError = nil
            }
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
        guard !isSigningIn else { return }
        guard !usernameOrEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            errorMessage = "Enter both your username or email address and password."
            return
        }

        nostrIdentity.pause()
        let selectedServer = serverURLString
        isSigningIn = true
        requiresBrowserSignIn = false
        browserSignInError = nil
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let mobileSession = try await api.signIn(
                serverURLString: selectedServer,
                usernameOrEmail: usernameOrEmail,
                password: password
            )
            try Task.checkCancellation()
            guard serverURLString == selectedServer else { return }
            try storeSession(mobileSession, server: selectedServer)
        } catch is CancellationError {
            return
        } catch {
            guard serverURLString == selectedServer else { return }
            if let apiError = error as? TrustrootsAPIError, case .webSignInRequired = apiError {
                requiresBrowserSignIn = true
            }
            errorMessage = error.localizedDescription
        }
    }

    func signInUsingBrowser(open: @MainActor (URL) async throws -> URL) async {
        guard requiresBrowserSignIn, member == nil, !isSigningIn else { return }
        let selectedServer = serverURLString
        isSigningIn = true
        browserSignInError = nil
        defer { isSigningIn = false }

        do {
            let attempt = try MobileBrowserSignIn(serverURLString: selectedServer)
            let callback = try await open(attempt.startURL)
            try Task.checkCancellation()
            guard requiresBrowserSignIn, serverURLString == selectedServer, member == nil else { return }
            let mobileSession = try await api.exchangeBrowserSignIn(attempt: attempt, callbackURL: callback)
            try Task.checkCancellation()
            guard requiresBrowserSignIn, serverURLString == selectedServer, member == nil else { return }
            try storeSession(mobileSession, server: selectedServer)
        } catch is CancellationError {
            return
        } catch {
            guard requiresBrowserSignIn, serverURLString == selectedServer else { return }
            browserSignInError = error.localizedDescription
        }
    }

    private func storeSession(_ result: MobileSessionResponse, server: String) throws {
        guard credentialStore.save(result.credentials) else {
            throw TrustrootsAPIError.serverMessage("Secure credential storage is unavailable.")
        }
        requiresBrowserSignIn = false
        browserSignInError = nil
        errorMessage = nil
        member = result.member
        UserDefaults.standard.set(server, forKey: Self.persistedServerKey)
        if let encodedMember = try? JSONEncoder().encode(result.member) {
            UserDefaults.standard.set(encodedMember, forKey: Self.persistedMemberKey)
        }
        updateCacheScope()
    }

    func signOut() async {
        requiresBrowserSignIn = false
        browserSignInError = nil
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
        requiresBrowserSignIn = false
        browserSignInError = nil
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
