import SwiftUI

struct MapFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var showingHosts: Bool
    @Binding var showingCommunityNotes: Bool
    let circles: [TrustrootsCircle]
    @Binding var selectedCircleIDs: Set<String>

    var body: some View {
        NavigationStack {
            List {
                Section("Show") {
                    Toggle("Hosts", isOn: $showingHosts)
                        .tint(TrustrootsPalette.green)
                    Toggle("Community Notes via Nostroots", isOn: $showingCommunityNotes)
                        .tint(TrustrootsPalette.green)
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
            .navigationTitle("Search places")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") {
                        showingHosts = true
                        showingCommunityNotes = true
                        selectedCircleIDs.removeAll()
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
