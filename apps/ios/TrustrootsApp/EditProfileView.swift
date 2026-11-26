import SwiftUI
import TrustrootsShared

struct EditProfileView: View {
    @ObservedObject var session: MemberSessionStore
    let onSaved: () -> Void
    let onCancel: () -> Void
    @State private var draft = MemberProfileDraft(
        displayName: "", tagline: "", locationLiving: "", locationFrom: "", biography: ""
    )
    @State private var selectedLanguageCodes: Set<String> = []
    @State private var showingLanguagePicker = false
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button(action: onCancel) {
                    Image(systemName: "chevron.left")
                        .font(.headline.weight(.semibold))
                        .frame(width: 40, height: 40)
                }
                .accessibilityLabel("Back to profile")
                Spacer()
                Button("Cancel", action: onCancel)
                    .font(.subheadline.weight(.semibold))
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)

            if isLoading {
                ProgressView("Loading profile…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ComposeProfileEditor(
                    draft: $draft,
                    languages: selectedLanguageCodes.isEmpty ? nil : selectedLanguageCodes.sorted()
                        .map { TrustrootsLanguage.displayName(for: $0) }.joined(separator: ", "),
                    isSaving: isSaving,
                    error: errorMessage,
                    onChooseLanguages: { showingLanguagePicker = true },
                    onSave: { Task { await save() } }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task { await load() }
        .sheet(isPresented: $showingLanguagePicker) {
            NavigationStack {
                List(availableLanguageCodes, id: \.self) { code in
                    Toggle(
                        TrustrootsLanguage.displayName(for: code),
                        isOn: Binding(
                            get: { selectedLanguageCodes.contains(code) },
                            set: { isSelected in
                                if isSelected {
                                    selectedLanguageCodes.insert(code)
                                } else {
                                    selectedLanguageCodes.remove(code)
                                }
                            }
                        )
                    )
                }
                .navigationTitle("Languages")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { showingLanguagePicker = false }
                    }
                }
            }
        }
    }

    private var availableLanguageCodes: [String] {
        Array(Set(TrustrootsLanguage.availableCodes).union(selectedLanguageCodes))
            .sorted { TrustrootsLanguage.displayName(for: $0) < TrustrootsLanguage.displayName(for: $1) }
    }

    private func load() async {
        guard !isLoading, let username = session.member?.username else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let profile = try await api.profile(serverURLString: session.serverURLString, username: username)
            draft = MemberProfileDraft(
                displayName: profile.displayName,
                tagline: profile.tagline ?? "",
                locationLiving: profile.locationLiving ?? "",
                locationFrom: profile.locationFrom ?? "",
                biography: profile.description?.plainText ?? ""
            )
            selectedLanguageCodes = Set(profile.languages ?? [])
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        let displayName = draft.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isSaving, !displayName.isEmpty else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.updateProfile(
                serverURLString: session.serverURLString,
                displayName: displayName,
                tagline: draft.tagline.trimmingCharacters(in: .whitespacesAndNewlines),
                description: draft.biography.trimmingCharacters(in: .whitespacesAndNewlines),
                locationLiving: draft.locationLiving.trimmingCharacters(in: .whitespacesAndNewlines),
                locationFrom: draft.locationFrom.trimmingCharacters(in: .whitespacesAndNewlines),
                languages: selectedLanguageCodes.sorted()
            )
            onSaved()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
private struct ComposeProfileEditor: UIViewControllerRepresentable {
    @Binding var draft: MemberProfileDraft
    let languages: String?
    let isSaving: Bool
    let error: String?
    let onChooseLanguages: () -> Void
    let onSave: () -> Void

    final class Coordinator {
        let state = MemberProfileEditorState()
        var onEdit: ((MemberProfileDraft) -> Void)?
        var onChooseLanguages: (() -> Void)?
        var onSave: (() -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MemberProfileEditorViewControllerKt.MemberProfileEditorViewController(
            state: coordinator.state,
            onEdit: { [weak coordinator] in coordinator?.onEdit?($0) },
            onChooseLanguages: { [weak coordinator] in coordinator?.onChooseLanguages?() },
            onSave: { [weak coordinator] in coordinator?.onSave?() }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        let binding = $draft
        coordinator.onEdit = { binding.wrappedValue = $0 }
        coordinator.onChooseLanguages = onChooseLanguages
        coordinator.onSave = onSave
        coordinator.state.update(draft: draft, languages: languages, isSaving: isSaving, error: error)
    }
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    }
}
