import SwiftUI
import TrustrootsShared

struct AccountView: View {
    @ObservedObject var session: MemberSessionStore
    let openPasswordRecovery: () -> Void
    @State private var profile: MemberProfile?
    @State private var email = ""
    @State private var newsletter = false
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var verifyPassword = ""
    @State private var isLoading = false
    @State private var isSavingAccount = false
    @State private var isChangingPassword = false
    @State private var emailSectionHeight: CGFloat = 1
    @State private var accountConfirmation: String?
    @State private var accountError: String?
    @State private var confirmation: String?
    @State private var errorMessage: String?
    @State private var showNostranslationSigning = false

    private let api = TrustrootsAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Account")
                    .font(.largeTitle.bold())

                if isLoading && profile == nil {
                    ProgressView("Loading account…")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else {
                    NostrKeySection(
                        linkedNpub: profile?.nostrNpub,
                        profileLoaded: profile != nil,
                        updateProfileLink: updateNostrProfile
                    )
                    Button("Nostranslation signing") { showNostranslationSigning = true }
                    emailSection
                    passwordSection
                    signOutSection
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityIdentifier("account-scroll-view")
        .task { await loadAccount() }
        .sheet(isPresented: $showNostranslationSigning) {
            NostranslationSigningSheet(serverURLString: session.serverURLString)
        }
    }

    private var emailSection: some View {
        ComposeAccountPreferences(
            email: $email,
            newsletter: $newsletter,
            height: $emailSectionHeight,
            pendingEmail: profile?.emailTemporary,
            isSaving: isSavingAccount,
            confirmation: accountConfirmation,
            error: accountError,
            onSave: { Task { await saveAccount() } }
        )
        .frame(maxWidth: .infinity)
        .frame(height: emailSectionHeight)
        .clipped()
    }

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Password")
                .font(.headline)
            SecureField("Current password", text: $currentPassword)
            SecureField("New password", text: $newPassword)
            SecureField("Repeat new password", text: $verifyPassword)

            Button(isChangingPassword ? "Changing password…" : "Change password") {
                Task { await changePassword() }
            }
            .buttonStyle(.borderedProminent)
            .tint(TrustrootsPalette.green)
            .disabled(isChangingPassword || currentPassword.isEmpty || newPassword.isEmpty || verifyPassword.isEmpty)

            Button("Forgot your password?") {
                openPasswordRecovery()
            }
            .font(.subheadline.weight(.semibold))
        }
        .textFieldStyle(.roundedBorder)
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(alignment: .bottomLeading) {
            if let confirmation {
                Text(confirmation)
                    .font(.footnote)
                    .foregroundStyle(TrustrootsPalette.green)
                    .padding(.top, 8)
                    .offset(y: 30)
            }
        }
        .overlay(alignment: .bottomLeading) {
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.top, 8)
                    .offset(y: 30)
            }
        }
        .padding(.bottom, confirmation == nil && errorMessage == nil ? 0 : 24)
    }

    private var signOutSection: some View {
        Button(role: .destructive) {
            Task { await session.signOut() }
        } label: {
            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .buttonStyle(.bordered)
    }

    private func loadAccount() async {
        guard !isLoading, let username = session.member?.username else { return }
        let serverURLString = session.serverURLString
        isLoading = true
        email = session.member?.email ?? ""
        newsletter = session.member?.newsletter ?? false
        defer { isLoading = false }
        do {
            let capturedRevision = NostrIdentityManager.shared.revision
            let loaded = try await api.profile(serverURLString: serverURLString, username: username, allowSaved: false)
            guard NostrIdentityManager.shared.isCurrent(capturedRevision),
                  loaded.username.caseInsensitiveCompare(username) == .orderedSame else { return }
            try NostrIdentityManager.shared.considerLegacy(linkedNpub: loaded.nostrNpub, capturedRevision: capturedRevision)
            profile = loaded
            email = loaded.email ?? session.member?.email ?? email
            newsletter = loaded.newsletter ?? session.member?.newsletter ?? newsletter

            if session.member?.email == nil || session.member?.newsletter == nil {
                // Adoption changes the key revision; bind the next response to
                // the resulting account/key rather than the earlier candidate.
                let accountRevision = NostrIdentityManager.shared.revision
                let account = try await api.currentMember(serverURLString: serverURLString)
                guard NostrIdentityManager.shared.isCurrent(accountRevision),
                      account.username.caseInsensitiveCompare(username) == .orderedSame else { return }
                email = account.email ?? email
                newsletter = account.newsletter ?? newsletter
                session.updateAccountDetails(email: account.email, newsletter: account.newsletter)
            }
        } catch {
            accountError = error.localizedDescription
        }
    }

    @MainActor
    private func updateNostrProfile(_ npub: String?) async throws {
        let identity = NostrIdentityManager.shared
        let revision = identity.revision
        let server = session.serverURLString
        guard let username = session.member?.username, identity.isCurrent(revision) else {
            throw NostrIdentityError.inactiveSession
        }
        let proof: [String: Any]?
        if let npub {
            let challenge = try await api.nostrProfileChallenge(serverURLString: server, npub: npub)
            try Task.checkCancellation()
            guard identity.isCurrent(revision), identity.npub == npub, let secret = identity.secret() else {
                throw NostrIdentityError.inactiveSession
            }
            proof = try NIP07Bridge.signProfileChallenge(challenge, serverURLString: server, secret: secret)
        } else {
            proof = nil
        }
        try Task.checkCancellation()
        let updated = try await api.updateNostrProfile(serverURLString: server, npub: npub, proof: proof)
        guard identity.isCurrent(revision), updated.username.caseInsensitiveCompare(username) == .orderedSame else { return }
        profile = updated
    }

    private func saveAccount() async {
        let submittedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isSavingAccount, !submittedEmail.isEmpty else { return }
        isSavingAccount = true
        accountError = nil
        accountConfirmation = nil
        defer { isSavingAccount = false }
        do {
            let updated = try await api.updateAccount(
                serverURLString: session.serverURLString,
                email: submittedEmail,
                newsletter: newsletter
            )
            profile = updated
            email = updated.email ?? email
            newsletter = updated.newsletter ?? newsletter
            session.updateAccountDetails(email: email, newsletter: newsletter)
            accountConfirmation = "Account settings saved."
        } catch {
            accountError = error.localizedDescription
        }
    }

    private func changePassword() async {
        guard !isChangingPassword else { return }
        isChangingPassword = true
        errorMessage = nil
        confirmation = nil
        defer { isChangingPassword = false }
        do {
            try await api.changePassword(
                serverURLString: session.serverURLString,
                currentPassword: currentPassword,
                newPassword: newPassword,
                verifyPassword: verifyPassword
            )
            currentPassword = ""
            newPassword = ""
            verifyPassword = ""
            confirmation = "Your password has been changed."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
private struct ComposeAccountPreferences: UIViewControllerRepresentable {
    @Binding var email: String
    @Binding var newsletter: Bool
    @Binding var height: CGFloat
    let pendingEmail: String?
    let isSaving: Bool
    let confirmation: String?
    let error: String?
    let onSave: () -> Void

    final class Coordinator {
        let state = MemberAccountPreferencesState()
        var onEmail: ((String) -> Void)?
        var onNewsletter: ((Bool) -> Void)?
        var onSave: (() -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let measuredHeight = $height
        return MemberAccountPreferencesViewControllerKt.MemberAccountPreferencesViewController(
            state: coordinator.state,
            onEmail: { [weak coordinator] in coordinator?.onEmail?($0) },
            onNewsletter: { [weak coordinator] in coordinator?.onNewsletter?($0.boolValue) },
            onSave: { [weak coordinator] in coordinator?.onSave?() },
            onHeight: { value in
                let next = max(1, CGFloat(value.doubleValue))
                Task { @MainActor in
                    if measuredHeight.wrappedValue != next {
                        measuredHeight.wrappedValue = next
                    }
                }
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        let emailBinding = $email
        let newsletterBinding = $newsletter
        coordinator.onEmail = { emailBinding.wrappedValue = $0 }
        coordinator.onNewsletter = { newsletterBinding.wrappedValue = $0 }
        coordinator.onSave = onSave
        coordinator.state.update(
            email: email,
            newsletter: newsletter,
            pendingEmail: pendingEmail,
            isSaving: isSaving,
            confirmation: confirmation,
            error: error
        )
    }
}
