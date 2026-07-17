import SwiftUI

struct EditProfileView: View {
    @ObservedObject var session: MemberSessionStore
    let onSaved: () -> Void
    let onCancel: () -> Void
    @State private var displayName = ""
    @State private var tagline = ""
    @State private var description = ""
    @State private var locationLiving = ""
    @State private var locationFrom = ""
    @State private var selectedLanguageCodes: Set<String> = []
    @State private var showingLanguagePicker = false
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
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

                Text("Edit profile")
                    .font(.largeTitle.bold())

                if isLoading {
                    ProgressView("Loading profile…")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else {
                    field("Name", text: $displayName)
                    field("Tagline", text: $tagline)
                    field("Lives in", text: $locationLiving)
                    field("From", text: $locationFrom)
                    languagePicker

                    Text("About me")
                        .font(.headline)
                    TextEditor(text: $description)
                        .frame(minHeight: 360)
                        .padding(10)
                        .overlay {
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.secondary.opacity(0.28))
                        }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Button(isSaving ? "Saving…" : "Save profile") {
                        Task { await save() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TrustrootsPalette.green)
                    .disabled(isSaving || displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
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

    private func field(_ title: String, text: Binding<String>, prompt: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.headline)
            TextField(prompt ?? title, text: text)
                .padding(12)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var languagePicker: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Languages").font(.headline)
            Button {
                showingLanguagePicker = true
            } label: {
                HStack {
                    Text(
                        selectedLanguageCodes.isEmpty
                            ? "Choose languages"
                            : selectedLanguageCodes.sorted().map { TrustrootsLanguage.displayName(for: $0) }.joined(separator: ", ")
                    )
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(selectedLanguageCodes.isEmpty ? .secondary : .primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
            displayName = profile.displayName
            tagline = profile.tagline ?? ""
            description = profile.description?.plainText ?? ""
            locationLiving = profile.locationLiving ?? ""
            locationFrom = profile.locationFrom ?? ""
            selectedLanguageCodes = Set(profile.languages ?? [])
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        guard !isSaving else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            _ = try await api.updateProfile(
                serverURLString: session.serverURLString,
                displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                tagline: tagline.trimmingCharacters(in: .whitespacesAndNewlines),
                description: description.trimmingCharacters(in: .whitespacesAndNewlines),
                locationLiving: locationLiving.trimmingCharacters(in: .whitespacesAndNewlines),
                locationFrom: locationFrom.trimmingCharacters(in: .whitespacesAndNewlines),
                languages: selectedLanguageCodes.sorted()
            )
            onSaved()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    }
}
