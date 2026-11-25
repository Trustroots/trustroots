import SwiftUI

struct MemberSearchView: View {
    @ObservedObject var session: MemberSessionStore
    var showsNavigationBar = true
    var isActive = true
    @State private var query = ""
    @State private var results: [MemberSearchResult] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var errorMessage: String?
    @State private var filters = MemberSearchFilters()
    @State private var submittedFilters = MemberSearchFilters()
    @State private var showingFilters = false
    @State private var circles: [TrustrootsCircle] = []
    @FocusState private var isSearchFocused: Bool

    private let api = TrustrootsAPI()

    var body: some View {
        if showsNavigationBar {
            NavigationStack {
                content
                    .navigationTitle("Find members")
                    .navigationBarTitleDisplayMode(.inline)
            }
        } else {
            content
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            Button("Member filters", systemImage: "slider.horizontal.3") {
                isSearchFocused = false
                showingFilters = true
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.horizontal, 12)
            .disabled(isSearching)
            Group {
                if isSearching {
                    ProgressView("Finding members…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage {
                    ContentUnavailableView {
                        Label(
                            "Member search unavailable",
                            systemImage: "person.crop.circle.badge.exclamationmark"
                        )
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Try again") { Task { await search() } }
                    }
                } else if hasSearched && results.isEmpty {
                    ContentUnavailableView(
                        "No members found",
                        systemImage: "person.2.slash",
                        description: Text("Try a different search or change your filters.")
                    )
                } else if results.isEmpty {
                    ContentUnavailableView(
                        "Find members",
                        systemImage: "person.crop.circle.badge.magnifyingglass",
                        description: Text("Search by name, username, location or tagline.")
                    )
                } else {
                    List(results) { member in
                        NavigationLink {
                            MemberProfileView(session: session, username: member.username)
                        } label: {
                            memberRow(member)
                        }
                        .accessibilityIdentifier("member-search-result-\(member.username)")
                    }
                    .listStyle(.plain)
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { searchForm }
        .onChange(of: isActive) { _, active in
            if !active { isSearchFocused = false }
        }
        .sheet(isPresented: $showingFilters, onDismiss: {
            if hasSearched && filters != submittedFilters {
                Task { await search() }
            }
        }) {
            filterSheet
        }
    }

    private var filterSheet: some View {
        NavigationStack {
            List {
                Section("Members") {
                    Toggle("Hosts", isOn: $filters.hosts)
                    Toggle("Meetings", isOn: $filters.meetings)
                    Toggle("Offers volunteering", isOn: $filters.volunteering)
                    Toggle("My connections only", isOn: $filters.connectionsOnly)
                    Toggle("Online in the past 6 months", isOn: $filters.onlineRecently)
                    NavigationLink {
                        SearchLanguagePicker(languages: $filters.languages)
                    } label: {
                        LabeledContent("Spoken languages", value: filters.languages.isEmpty ? "Any" : String(filters.languages.count))
                    }
                }
                Section("Circles") {
                    ForEach(circles) { circle in
                        Toggle(circle.label, isOn: Binding(
                            get: { filters.circleIDs.contains(circle.id) },
                            set: { selected in
                                if selected { filters.circleIDs.insert(circle.id) }
                                else { filters.circleIDs.remove(circle.id) }
                            }
                        ))
                    }
                }
            }
            .task {
                if circles.isEmpty {
                    circles = (try? await api.circles(serverURLString: session.serverURLString)) ?? []
                }
            }
            .navigationTitle("Member filters")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") { filters = MemberSearchFilters() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showingFilters = false }
                }
            }
        }
    }

    private var searchForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 9) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Name, username, location or tagline", text: $query)
                    .accessibilityIdentifier("member-search-field")
                    .focused($isSearchFocused)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .onSubmit {
                        guard canSearch else { return }
                        isSearchFocused = false
                        Task { await search() }
                    }
                    .onChange(of: query) {
                        if query.count > 120 { query = String(query.prefix(120)) }
                        hasSearched = false
                        errorMessage = nil
                    }
                if !query.isEmpty {
                    Button {
                        query = ""
                        results = []
                        hasSearched = false
                        errorMessage = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityLabel("Clear member search")
                }
                Button {
                    isSearchFocused = false
                    Task { await search() }
                } label: {
                    Image(systemName: "arrow.right.circle.fill")
                        .font(.title2)
                }
                .disabled(!canSearch || isSearching)
                .accessibilityLabel("Search members")
            }
            .padding(.horizontal, 13)
            .frame(height: 46)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            if !trimmedQuery.isEmpty && !canSearch {
                Text("Enter at least 3 characters.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.regularMaterial)
        .overlay(alignment: .top) {
            Divider()
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Button("Search") {
                    isSearchFocused = false
                    Task { await search() }
                }
                .disabled(!canSearch || isSearching)
                Spacer()
                Button("Done") {
                    isSearchFocused = false
                }
                .fontWeight(.semibold)
            }
        }
    }

    private func memberRow(_ member: MemberSearchResult) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            MemberIdentityView(
                member: MiniMember(id: member.id, username: member.username, displayName: member.displayName),
                serverURLString: session.serverURLString
            )
            if let location = member.locationSummary {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 5)
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSearch: Bool {
        trimmedQuery.count >= 3
    }

    @MainActor
    private func search() async {
        guard canSearch, !isSearching else { return }
        isSearching = true
        hasSearched = true
        errorMessage = nil
        let submittedQuery = trimmedQuery
        submittedFilters = filters
        defer { isSearching = false }

        do {
            let matches = try await api.searchMembers(
                serverURLString: session.serverURLString,
                query: submittedQuery,
                filters: submittedFilters
            )
            if submittedQuery == trimmedQuery { results = matches }
        } catch {
            guard submittedQuery == trimmedQuery else { return }
            results = []
            errorMessage = error.localizedDescription
        }
    }
}
