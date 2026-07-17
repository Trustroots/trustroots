import SwiftUI

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
    @State private var confirmation: String?
    @State private var errorMessage: String?

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
                    NostrKeySection()
                    emailSection
                    passwordSection
                    signOutSection
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .task { await loadAccount() }
    }

    private var emailSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Email")
                .font(.headline)
            HStack(spacing: 10) {
                TextField("Email address", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .textContentType(.emailAddress)
                    .padding(12)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(TrustrootsPalette.green.opacity(0.45), lineWidth: 1)
                    }

                Button {
                    Task { await saveAccount() }
                } label: {
                    if isSavingAccount {
                        ProgressView()
                            .frame(width: 22, height: 22)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.headline.weight(.bold))
                            .frame(width: 22, height: 22)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(TrustrootsPalette.green)
                .accessibilityLabel("Save")
                .disabled(isSavingAccount || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Toggle("Community newsletter", isOn: $newsletter)
                .tint(TrustrootsPalette.green)
            if let pendingEmail = profile?.emailTemporary {
                Text("Email confirmation is pending for \(pendingEmail).")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
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
        isLoading = true
        email = session.member?.email ?? ""
        newsletter = session.member?.newsletter ?? false
        defer { isLoading = false }
        do {
            let loaded = try await api.profile(serverURLString: session.serverURLString, username: username)
            profile = loaded
            email = loaded.email ?? session.member?.email ?? email
            newsletter = loaded.newsletter ?? session.member?.newsletter ?? newsletter

            if session.member?.email == nil || session.member?.newsletter == nil {
                let account = try await api.currentMember(serverURLString: session.serverURLString)
                email = account.email ?? email
                newsletter = account.newsletter ?? newsletter
                session.updateAccountDetails(email: account.email, newsletter: account.newsletter)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveAccount() async {
        guard !isSavingAccount else { return }
        isSavingAccount = true
        errorMessage = nil
        confirmation = nil
        defer { isSavingAccount = false }
        do {
            let updated = try await api.updateAccount(
                serverURLString: session.serverURLString,
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                newsletter: newsletter
            )
            profile = updated
            email = updated.email ?? email
            newsletter = updated.newsletter ?? newsletter
            session.updateAccountDetails(email: email, newsletter: newsletter)
            confirmation = "Account settings saved."
        } catch {
            errorMessage = error.localizedDescription
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
