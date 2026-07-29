import SwiftUI

struct NostrKeySection: View {
    @ObservedObject private var identity = NostrIdentityManager.shared
    @State private var importedKey = ""
    @State private var errorMessage: String?
    @State private var showingRemovalConfirmation = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Nostr key")
                .font(.headline)
            Text("Optional: lets the built-in Trustroots browser use Nostr features. Your private key is never given to web pages.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if identity.publicKey != nil {
                Text("Public key (npub)")
                    .font(.subheadline.weight(.semibold))
                if let npub = identity.npub {
                    Text(npub)
                        .font(.footnote.monospaced())
                        .textSelection(.enabled)
                        .lineLimit(3)
                }
                Text("This is an app-local key. Sharing a key with the Nostroots Expo app needs a separate shared-Keychain migration.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Remove key", role: .destructive) {
                    showingRemovalConfirmation = true
                }
            } else {
                Text("Create or import a key")
                    .font(.subheadline.weight(.semibold))
                TextEditor(text: $importedKey)
                    .font(.body.monospaced())
                    .frame(minHeight: 110)
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityLabel("Nostr private key")
                Button("Import private key") { importKey() }
                    .buttonStyle(.borderedProminent)
                    .tint(TrustrootsPalette.green)
                    .disabled(importedKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Generate new key") { generateKey() }
                    .buttonStyle(.bordered)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .alert("Remove Nostr key?", isPresented: $showingRemovalConfirmation) {
            Button("Remove", role: .destructive) { removeKey() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the app-local key and revokes its website permissions. It cannot be recovered from Trustroots.")
        }
    }

    private func importKey() {
        do {
            try identity.import(importedKey)
            importedKey = ""
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func generateKey() {
        do {
            try identity.generate()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func removeKey() {
        do {
            try identity.remove()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
