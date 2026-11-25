import SwiftUI

struct MapFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var showingHosts: Bool
    @Binding var showingMeet: Bool
    @Binding var showingCommunityNotes: Bool
    @Binding var activityMonths: Int?
    let circles: [TrustrootsCircle]
    @Binding var selectedCircleIDs: Set<String>
    @Binding var languages: Set<String>
    @Binding var volunteering: Bool
    @Binding var connectionsOnly: Bool

    var body: some View {
        NavigationStack {
            List {
                Section("Show") {
                    Toggle("Hosts", isOn: $showingHosts)
                        .tint(TrustrootsPalette.green)
                        .onChange(of: showingHosts) { _, enabled in
                            if !enabled { volunteering = false }
                        }
                    Toggle("Meet", isOn: $showingMeet)
                        .tint(TrustrootsPalette.green)
                    Toggle("Offers volunteering", isOn: $volunteering)
                        .tint(TrustrootsPalette.green)
                        .onChange(of: volunteering) { _, enabled in
                            if enabled { showingHosts = true }
                        }
                    Toggle("Community Notes via Nostroots", isOn: Binding(
                        get: { showingCommunityNotes && !connectionsOnly },
                        set: { showingCommunityNotes = $0 }
                    ))
                        .tint(TrustrootsPalette.green)
                        .disabled(connectionsOnly)
                }

                Section("Members") {
                    Toggle("My connections only", isOn: $connectionsOnly)
                        .tint(TrustrootsPalette.green)
                    Picker("Last active", selection: $activityMonths) {
                        Text("Past month").tag(Optional(1))
                        Text("Past 6 months").tag(Optional(6))
                        Text("Any time").tag(nil as Int?)
                    }
                    NavigationLink {
                        SearchLanguagePicker(languages: $languages)
                    } label: {
                        LabeledContent("Spoken languages", value: languages.isEmpty ? "Any" : String(languages.count))
                    }
                }

                Section("Circles") {
                    if circles.isEmpty {
                        Text("Loading circles…")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(circles) { circle in
                            Toggle(
                                "\(circle.label) · \(circle.count) members",
                                isOn: Binding(
                                    get: { selectedCircleIDs.contains(circle.id) },
                                    set: { isSelected in
                                        if isSelected {
                                            selectedCircleIDs.insert(circle.id)
                                        } else {
                                            selectedCircleIDs.remove(circle.id)
                                        }
                                    }
                                )
                            )
                            .tint(TrustrootsPalette.green)
                        }
                    }
                }
            }
            .navigationTitle("Search filters")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") {
                        showingHosts = true
                        showingMeet = false
                        showingCommunityNotes = true
                        activityMonths = 6
                        volunteering = false
                        connectionsOnly = false
                        selectedCircleIDs.removeAll()
                        languages.removeAll()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: dismiss.callAsFunction)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct SearchLanguagePicker: View {
    @Binding var languages: Set<String>
    @State private var query = ""

    var body: some View {
        List {
            if !languages.isEmpty {
                Button("Clear languages") { languages.removeAll() }
            }
            ForEach(TrustrootsLanguage.availableCodes.filter(matches), id: \.self) { code in
                Toggle(TrustrootsLanguage.displayName(for: code), isOn: Binding(
                    get: { languages.contains(code) },
                    set: { enabled in
                        if enabled { languages.insert(code) }
                        else { languages.remove(code) }
                    }
                ))
            }
        }
        .navigationTitle("Spoken languages")
        .searchable(text: $query)
    }

    private func matches(_ code: String) -> Bool {
        query.isEmpty || code.localizedCaseInsensitiveContains(query)
            || TrustrootsLanguage.displayName(for: code).localizedCaseInsensitiveContains(query)
    }
}
