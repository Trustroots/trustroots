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
    @State private var emailSectionOrigin: CGPoint = .zero
    @State private var passwordActionsHeight: CGFloat = 1
    @State private var accountConfirmation: String?
    @State private var accountError: String?
    @State private var confirmation: String?
    @State private var errorMessage: String?
    @State private var showNostranslationSigning = false
    @State private var showEmailChange = false

    private let api = TrustrootsAPI()

    private var requiresEmailConfirmation: Bool {
        profile?.emailConfirmed ?? session.member?.isPublic ?? true
    }

    private var pendingEmail: String? {
        guard let pending = profile?.emailTemporary, !pending.isEmpty else { return nil }
        return pending
    }

    private var canCancelEmailChange: Bool {
        guard let pendingEmail, let currentEmail = profile?.email ?? session.member?.email else { return false }
        return requiresEmailConfirmation && pendingEmail.caseInsensitiveCompare(currentEmail) != .orderedSame
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ComposeAccountOverviewSection(section: .heading)

                if isLoading && profile == nil {
                    ProgressView("Loading account…")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else {
                    NostrKeySection(
                        linkedNpub: profile?.nostrNpub,
                        profileLoaded: profile != nil,
                        updateProfileLink: updateNostrProfile
                    )
                    ComposeAccountOverviewSection(section: .signing) {
                        showNostranslationSigning = true
                    }
                    emailSection
                    passwordSection
                    ComposeAccountOverviewSection(section: .signout) {
                        Task { await session.signOut() }
                    }
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
        .sheet(isPresented: $showEmailChange) {
            AccountEmailChangeSheet(mfaEnabled: profile?.mfaEnabled, submit: changeEmail)
        }
    }

    private var emailSection: some View {
        ComposeAccountPreferences(
            email: $email,
            newsletter: $newsletter,
            height: $emailSectionHeight,
            origin: emailSectionOrigin,
            canCorrectSignupEmail: !requiresEmailConfirmation,
            pendingEmail: pendingEmail,
            canCancelEmailChange: canCancelEmailChange,
            isSaving: isSavingAccount,
            confirmation: accountConfirmation,
            error: accountError,
            onSave: { Task { await saveAccount() } },
            onChangeEmail: { showEmailChange = true },
            onCancelEmailChange: { Task { await cancelEmailChange() } }
        )
        .frame(maxWidth: .infinity)
        .frame(height: emailSectionHeight)
        .clipped()
        .onGeometryChange(for: CGPoint.self) { $0.frame(in: .global).origin } action: { emailSectionOrigin = $0 }
    }

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Password")
                .font(.headline)
            SecureField("Current password", text: $currentPassword)
            SecureField("New password", text: $newPassword)
            SecureField("Repeat new password", text: $verifyPassword)

            ComposePasswordActions(
                height: $passwordActionsHeight,
                canSubmit: hasPasswordInputs,
                isChanging: isChangingPassword,
                confirmation: confirmation,
                error: errorMessage,
                onChangePassword: { Task { await changePassword() } },
                onRecoverPassword: openPasswordRecovery
            )
            .frame(maxWidth: .infinity)
            .frame(height: passwordActionsHeight)
            .clipped()
        }
        .textFieldStyle(.roundedBorder)
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var hasPasswordInputs: Bool {
        !currentPassword.isEmpty && !newPassword.isEmpty && !verifyPassword.isEmpty
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
        let signupEmail = requiresEmailConfirmation ? nil : email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isSavingAccount, signupEmail?.isEmpty != true else { return }
        let submittedNewsletter = newsletter
        do {
            let updated = try await updateAccount { server in
                try await api.updateAccount(serverURLString: server, email: signupEmail, newsletter: submittedNewsletter)
            }
            newsletter = updated.newsletter ?? submittedNewsletter
            accountConfirmation = "Account settings saved."
        } catch {
            accountError = error.localizedDescription
        }
    }

    private func changeEmail(email: String, password: String, mfaCode: String?) async throws {
        _ = try await updateAccount { server in
            try await api.changeAccountEmail(
                serverURLString: server, email: email, currentPassword: password, mfaCode: mfaCode
            )
        }
        accountConfirmation = "Check your new email address to confirm the change."
    }

    private func cancelEmailChange() async {
        guard !isSavingAccount, canCancelEmailChange, let pendingEmail else { return }
        do {
            _ = try await updateAccount { server in
                try await api.cancelAccountEmailChange(serverURLString: server, newEmail: pendingEmail)
            }
            accountConfirmation = "Pending email change cancelled."
        } catch {
            accountError = error.localizedDescription
        }
    }

    private func updateAccount(_ request: (String) async throws -> MemberProfile) async throws -> MemberProfile {
        guard let username = session.member?.username else { throw TrustrootsAPIError.authenticationRequired }
        guard !isSavingAccount else { throw TrustrootsAPIError.serverMessage("An account update is already in progress.") }
        let server = session.serverURLString
        isSavingAccount = true
        accountError = nil
        accountConfirmation = nil
        defer { isSavingAccount = false }

        let updated = try await request(server)
        guard session.serverURLString == server,
              session.member?.username.caseInsensitiveCompare(username) == .orderedSame,
              updated.username.caseInsensitiveCompare(username) == .orderedSame else {
            throw TrustrootsAPIError.authenticationRequired
        }
        profile = updated
        email = updated.email ?? email
        session.updateAccountDetails(email: updated.email, newsletter: updated.newsletter)
        return updated
    }

    private func changePassword() async {
        guard hasPasswordInputs, !isChangingPassword else { return }
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

private struct AccountEmailChangeSheet: View {
    let mfaEnabled: Bool?
    let submit: (String, String, String?) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focus: Field?
    @State private var email = ""
    @State private var password = ""
    @State private var mfaCode = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private enum Field: Hashable { case email, password, mfaCode }

    private var canSubmit: Bool {
        !isSubmitting && !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !password.isEmpty && (mfaEnabled != true || !mfaCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("New email address", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                        .accessibilityIdentifier("account-email-change-address")
                    SecureField("Current password", text: $password)
                        .textContentType(.password)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .password)
                        .submitLabel(mfaEnabled == false ? .done : .next)
                        .onSubmit { focus = mfaEnabled == false ? nil : .mfaCode }
                        .accessibilityIdentifier("account-email-change-password")
                    if mfaEnabled != false {
                        TextField(mfaEnabled == true ? "Authenticator or recovery code" : "Authenticator or recovery code (if enabled)", text: $mfaCode)
                            .textContentType(.oneTimeCode)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .focused($focus, equals: .mfaCode)
                            .submitLabel(.done)
                            .onSubmit { focus = nil }
                            .accessibilityIdentifier("account-email-change-code")
                    }
                } footer: {
                    Text("Your current address stays active until you confirm the new one.")
                }
                .disabled(isSubmitting)
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
            .navigationTitle("Change email")
            .navigationBarTitleDisplayMode(.inline)
            .interactiveDismissDisabled(isSubmitting)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSubmitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmitting ? "Sending…" : "Send confirmation") { Task { await confirm() } }
                        .disabled(!canSubmit)
                        .accessibilityIdentifier("account-email-change-submit")
                }
            }
        }
    }

    private func confirm() async {
        guard canSubmit else { return }
        isSubmitting = true
        errorMessage = nil
        focus = nil
        defer { isSubmitting = false }
        do {
            try await submit(email, password, mfaEnabled == false ? nil : mfaCode)
            password = ""
            mfaCode = ""
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
private struct ComposeAccountOverviewSection: View {
    let section: MemberAccountOverviewSection
    let onAction: () -> Void
    @State private var height: CGFloat = 1

    init(section: MemberAccountOverviewSection, onAction: @escaping () -> Void = {}) {
        self.section = section
        self.onAction = onAction
    }

    var body: some View {
        Controller(section: section, onAction: onAction, height: $height)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipped()
    }

    private struct Controller: UIViewControllerRepresentable {
        let section: MemberAccountOverviewSection
        let onAction: () -> Void
        @Binding var height: CGFloat

        final class Coordinator {
            var onAction: () -> Void = {}
        }

        func makeCoordinator() -> Coordinator { Coordinator() }

        func makeUIViewController(context: Context) -> UIViewController {
            let coordinator = context.coordinator
            coordinator.onAction = onAction
            let measuredHeight = $height
            return MemberAccountOverviewViewControllerKt.MemberAccountOverviewViewController(
                section: section,
                onAction: { [weak coordinator] in coordinator?.onAction() },
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
            context.coordinator.onAction = onAction
        }
    }
}

@MainActor
private struct ComposePasswordActions: UIViewControllerRepresentable {
    @Binding var height: CGFloat
    let canSubmit: Bool
    let isChanging: Bool
    let confirmation: String?
    let error: String?
    let onChangePassword: () -> Void
    let onRecoverPassword: () -> Void

    final class Coordinator {
        let state = MemberAccountPasswordActionsState()
        var onChangePassword: (() -> Void)?
        var onRecoverPassword: (() -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let measuredHeight = $height
        return MemberAccountPasswordActionsViewControllerKt.MemberAccountPasswordActionsViewController(
            state: coordinator.state,
            onChangePassword: { [weak coordinator] in coordinator?.onChangePassword?() },
            onRecoverPassword: { [weak coordinator] in coordinator?.onRecoverPassword?() },
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
        coordinator.onChangePassword = onChangePassword
        coordinator.onRecoverPassword = onRecoverPassword
        coordinator.state.update(
            canSubmit: canSubmit,
            isChanging: isChanging,
            confirmation: confirmation,
            error: error
        )
    }
}

@MainActor
private struct ComposeAccountPreferences: UIViewControllerRepresentable {
    @Binding var email: String
    @Binding var newsletter: Bool
    @Binding var height: CGFloat
    let origin: CGPoint
    let canCorrectSignupEmail: Bool
    let pendingEmail: String?
    let canCancelEmailChange: Bool
    let isSaving: Bool
    let confirmation: String?
    let error: String?
    let onSave: () -> Void
    let onChangeEmail: () -> Void
    let onCancelEmailChange: () -> Void

    final class Coordinator {
        let state = MemberAccountPreferencesState()
        var onEmail: ((String) -> Void)?
        var onNewsletter: ((Bool) -> Void)?
        var onSave: (() -> Void)?
        var onChangeEmail: (() -> Void)?
        var onCancelEmailChange: (() -> Void)?
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
            onChangeEmail: { [weak coordinator] in coordinator?.onChangeEmail?() },
            onCancelEmailChange: { [weak coordinator] in coordinator?.onCancelEmailChange?() },
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
        coordinator.onChangeEmail = onChangeEmail
        coordinator.onCancelEmailChange = onCancelEmailChange
        coordinator.state.updateOrigin(x: Double(origin.x), y: Double(origin.y))
        coordinator.state.update(
            email: email,
            newsletter: newsletter,
            canCorrectSignupEmail: canCorrectSignupEmail,
            pendingEmail: pendingEmail,
            canCancelEmailChange: canCancelEmailChange,
            isSaving: isSaving,
            confirmation: confirmation,
            error: error
        )
    }
}
