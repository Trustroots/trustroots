import SwiftUI

struct MemberSearchView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var query = ""
    @State private var results: [MemberSearchResult] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var errorMessage: String?
    @FocusState private var isSearchFocused: Bool

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            Group {
                if isSearching {
                    ProgressView("Finding members…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage {
                    ContentUnavailableView(
                        "Member search unavailable",
                        systemImage: "person.crop.circle.badge.exclamationmark",
                        description: Text(errorMessage)
                    )
                } else if hasSearched && results.isEmpty {
                    ContentUnavailableView(
                        "No members found",
                        systemImage: "person.2.slash",
                        description: Text("Try another name or username.")
                    )
                } else if results.isEmpty {
                    ContentUnavailableView(
                        "Find members",
                        systemImage: "person.crop.circle.badge.magnifyingglass",
                        description: Text("Search by name or username.")
                    )
                } else {
                    List(results) { member in
                        NavigationLink {
                            MemberProfileView(session: session, username: member.username)
                        } label: {
                            memberRow(member)
                        }
                    }
                    .listStyle(.plain)
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .navigationTitle("Find members")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                searchForm
            }
        }
    }

    private var searchForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 9) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Name or username", text: $query)
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
        HStack(spacing: 14) {
            MemberAvatarView(
                memberID: member.id,
                displayName: member.displayName,
                serverURLString: session.serverURLString,
                size: 64
            )
            VStack(alignment: .leading, spacing: 3) {
                Text(member.displayName)
                    .font(.headline)
                Text("@\(member.username)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let location = member.locationSummary {
                    Label(location, systemImage: "mappin.and.ellipse")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
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
        defer { isSearching = false }

        do {
            results = try await api.searchMembers(
                serverURLString: session.serverURLString,
                query: trimmedQuery
            )
        } catch {
            results = []
            errorMessage = error.localizedDescription
        }
    }
}
