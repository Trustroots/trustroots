import SwiftUI
import UIKit

struct NostrKeySection: View {
    let linkedNpub: String?
    let profileLoaded: Bool
    let updateProfileLink: @MainActor (String?) async throws -> Void
    @ObservedObject private var identity = NostrIdentityManager.shared
    @Environment(\.scenePhase) private var scenePhase
    @State private var importedKey = ""
    @State private var errorMessage: String?
    @State private var revealedSecret: String?
    @State private var backupTask: Task<Void, Never>?
    @State private var backupRequestID: UUID?
    @State private var showingRemovalConfirmation = false
    @State private var showingProfileConfirmation = false
    @State private var pendingProfileKey: String?
    @State private var isUpdatingProfile = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Nostr key").font(.headline)
            Text("Your local key belongs to this Trustroots server and account. Your private key stays on this device.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text("Profile-linked public key").font(.subheadline.weight(.semibold))
            if profileLoaded {
                if let linkedNpub, !linkedNpub.isEmpty {
                    keyText(linkedNpub)
                } else {
                    Text("No linked public key.").foregroundStyle(.secondary)
                }
            } else {
                Text("Profile key unavailable. Connect to load your profile.").foregroundStyle(.secondary)
            }
            if profileLoaded {
                if let npub = identity.npub, npub != linkedNpub {
                    Button(linkedNpub?.isEmpty == false ? "Replace profile key" : "Link local key to profile") {
                        if linkedNpub?.isEmpty == false {
                            pendingProfileKey = npub
                            showingProfileConfirmation = true
                        } else {
                            changeProfileLink(npub)
                        }
                    }
                    .disabled(isUpdatingProfile)
                }
                if linkedNpub?.isEmpty == false {
                    Button("Unlink profile key", role: .destructive) {
                        pendingProfileKey = nil
                        showingProfileConfirmation = true
                    }
                    .disabled(isUpdatingProfile || !identity.isActive)
                }
                if isUpdatingProfile { ProgressView("Updating profile key…") }
            }

            Text("Local public key (npub)").font(.subheadline.weight(.semibold))
            if let npub = identity.npub {
                keyText(npub).accessibilityIdentifier("nostr-local-public-key")
                Button("Copy public key") { UIPasteboard.general.string = npub }
                if let revealedSecret {
                    Text("Private key (nsec) — keep this secret").font(.subheadline.weight(.semibold))
                    Text(revealedSecret)
                        .font(.footnote.monospaced())
                        .accessibilityIdentifier("nostr-backup-secret")
                        .privacySensitive()
                    Button("Hide private key") { hideBackup() }
                } else {
                    Button(backupTask == nil ? "Back up private key" : "Authenticating…") { revealBackup() }
                        .disabled(backupTask != nil)
                }
                Button("Remove local key", role: .destructive) { showingRemovalConfirmation = true }
                    .disabled(isUpdatingProfile)
            } else {
                Text("No local key for this account.").foregroundStyle(.secondary)
                if let legacyNpub = identity.legacyNpub {
                    Text("Unclaimed key from this installation").font(.subheadline.weight(.semibold))
                    keyText(legacyNpub)
                    Text("Claim this key only if it is yours. Claiming does not link it to your profile.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Claim this local key") { perform { try identity.claimLegacy() } }
                }
                SecureField("Nostr private key (nsec or hex)", text: $importedKey)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.asciiCapable)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("nostr-import-key")
                Button("Import private key") {
                    perform {
                        try identity.import(importedKey)
                        importedKey = ""
                    }
                }
                .disabled(importedKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !identity.isActive)
                Button("Generate new key") { perform { try identity.generate() } }
                    .buttonStyle(.bordered)
                    .disabled(!identity.isActive)
            }
            if let message = errorMessage ?? identity.errorMessage {
                Text(message).font(.footnote).foregroundStyle(.red)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("nostr-key-section")
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .alert("Remove local Nostr key?", isPresented: $showingRemovalConfirmation) {
            Button("Remove", role: .destructive) { perform { try identity.remove() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Back up your private key first. This removes this account's key from this phone and revokes website permissions. Your profile-linked key stays unchanged.")
        }
        .alert(pendingProfileKey == nil ? "Unlink profile key?" : "Replace profile key?", isPresented: $showingProfileConfirmation) {
            Button(pendingProfileKey == nil ? "Unlink" : "Replace", role: .destructive) {
                changeProfileLink(pendingProfileKey)
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(pendingProfileKey == nil
                 ? "This removes the public key from your profile. The local private key stays on this phone."
                 : "This changes which public key is linked to your profile. The local private key stays on this phone.")
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { revealedSecret = nil; importedKey = "" }
            // Device authentication can make the scene inactive. Backgrounding
            // cancels the request; an authentication sheet may finish on return.
            if phase == .background { hideBackup() }
        }
        .onChange(of: identity.revision) { _, _ in
            hideBackup()
            importedKey = ""
            errorMessage = nil
            showingRemovalConfirmation = false
            showingProfileConfirmation = false
        }
        .onDisappear { hideBackup(); importedKey = "" }
    }

    private func changeProfileLink(_ npub: String?) {
        guard !isUpdatingProfile else { return }
        hideBackup()
        errorMessage = nil
        isUpdatingProfile = true
        let revision = identity.revision
        Task { @MainActor in
            defer { isUpdatingProfile = false }
            guard identity.isCurrent(revision) else { return }
            do { try await updateProfileLink(npub) }
            catch { if identity.isCurrent(revision) { errorMessage = error.localizedDescription } }
        }
    }

    private func keyText(_ key: String) -> some View {
        Text(key).font(.footnote.monospaced()).textSelection(.enabled)
    }

    private func revealBackup() {
        errorMessage = nil
        let requestID = UUID()
        backupRequestID = requestID
        backupTask = Task { @MainActor in
            defer {
                if backupRequestID == requestID { backupTask = nil; backupRequestID = nil }
            }
            do {
                let secret = try await identity.backup()
                guard backupRequestID == requestID, !Task.isCancelled, scenePhase == .active else { return }
                revealedSecret = secret
            } catch {
                if backupRequestID == requestID, !Task.isCancelled { errorMessage = error.localizedDescription }
            }
        }
    }

    private func hideBackup() {
        backupRequestID = nil
        backupTask?.cancel()
        backupTask = nil
        revealedSecret = nil
    }

    private func perform(_ action: () throws -> Void) {
        hideBackup()
        do { try action(); errorMessage = nil }
        catch { errorMessage = error.localizedDescription }
    }
}
