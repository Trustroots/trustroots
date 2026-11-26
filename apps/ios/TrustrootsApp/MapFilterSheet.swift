import SwiftUI
import TrustrootsShared

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
    @State private var showingLanguages = false

    var body: some View {
        NavigationStack {
            ComposeOfferSearchFilters(
                selection: selection,
                onToggle: toggle,
                onActivity: selectActivity,
                onLanguages: { showingLanguages = true },
                onCircle: toggleCircle
            )
            .navigationDestination(isPresented: $showingLanguages) {
                SearchLanguagePicker(languages: $languages)
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

    private var selection: OfferSearchFilterSelection {
        let activity: OfferSearchActivity
        switch activityMonths {
        case 1: activity = .pastmonth
        case 6: activity = .pastsixmonths
        default: activity = .anytime
        }
        return OfferSearchFilterSelection(
            hosts: showingHosts,
            meet: showingMeet,
            volunteering: volunteering,
            communityNotes: showingCommunityNotes,
            connectionsOnly: connectionsOnly,
            activity: activity,
            languageCount: Int32(languages.count),
            circles: circles.map { circle in
                OfferSearchCircle(
                    id: circle.id,
                    label: "\(circle.label) · \(circle.count) members",
                    selected: selectedCircleIDs.contains(circle.id)
                )
            }
        )
    }

    private func toggle(_ filter: OfferSearchToggle) {
        switch filter {
        case .hosts:
            showingHosts.toggle()
            if !showingHosts { volunteering = false }
        case .meet:
            showingMeet.toggle()
        case .volunteering:
            volunteering.toggle()
            if volunteering { showingHosts = true }
        case .communitynotes:
            if !connectionsOnly { showingCommunityNotes.toggle() }
        case .connectionsonly:
            connectionsOnly.toggle()
        default:
            break
        }
    }

    private func selectActivity(_ activity: OfferSearchActivity) {
        switch activity {
        case .pastmonth: activityMonths = 1
        case .pastsixmonths: activityMonths = 6
        case .anytime: activityMonths = nil
        default: break
        }
    }

    private func toggleCircle(_ id: String) {
        if selectedCircleIDs.contains(id) {
            selectedCircleIDs.remove(id)
        } else {
            selectedCircleIDs.insert(id)
        }
    }
}

@MainActor
private struct ComposeOfferSearchFilters: UIViewControllerRepresentable {
    let selection: OfferSearchFilterSelection
    let onToggle: (OfferSearchToggle) -> Void
    let onActivity: (OfferSearchActivity) -> Void
    let onLanguages: () -> Void
    let onCircle: (String) -> Void

    final class Coordinator {
        let state = OfferSearchFiltersState()
        var onToggle: ((OfferSearchToggle) -> Void)?
        var onActivity: ((OfferSearchActivity) -> Void)?
        var onLanguages: (() -> Void)?
        var onCircle: ((String) -> Void)?
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MainViewControllerKt.OfferSearchFiltersViewController(
            state: coordinator.state,
            onToggle: { [weak coordinator] in coordinator?.onToggle?($0) },
            onActivity: { [weak coordinator] in coordinator?.onActivity?($0) },
            onLanguages: { [weak coordinator] in coordinator?.onLanguages?() },
            onCircle: { [weak coordinator] in coordinator?.onCircle?($0) }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onToggle = onToggle
        coordinator.onActivity = onActivity
        coordinator.onLanguages = onLanguages
        coordinator.onCircle = onCircle
        coordinator.state.update(selection: selection)
    }
}

struct SearchLanguagePicker: View {
    @Binding var languages: Set<String>
    @State private var query = ""

    private static let catalogue: [String: String] = {
        if let url = Bundle.main.url(forResource: "languages", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let names = try? JSONDecoder().decode([String: String].self, from: data) {
            return names
        }
        return Dictionary(uniqueKeysWithValues: TrustrootsLanguage.availableCodes.map {
            ($0, TrustrootsLanguage.displayName(for: $0))
        })
    }()

    private var choices: [String] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let codes = needle.isEmpty
            ? languages.union(TrustrootsLanguage.commonCodes)
            : Set(Self.catalogue.keys.filter {
                $0.localizedCaseInsensitiveContains(needle)
                    || label(for: $0).localizedCaseInsensitiveContains(needle)
            })
        return codes.sorted { label(for: $0).localizedStandardCompare(label(for: $1)) == .orderedAscending }
    }

    var body: some View {
        List {
            if !languages.isEmpty {
                Button("Clear languages") { languages.removeAll() }
            }
            ForEach(choices, id: \.self) { code in
                Toggle(label(for: code), isOn: Binding(
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

    private func label(for code: String) -> String {
        Self.catalogue[code] ?? TrustrootsLanguage.displayName(for: code)
    }
}
