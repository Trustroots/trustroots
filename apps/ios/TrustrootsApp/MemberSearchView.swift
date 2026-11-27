import SwiftUI
import TrustrootsShared

struct MemberSearchView: View {
    @ObservedObject var session: MemberSessionStore
    let state: MemberSearchState
    var showsNavigationBar = true
    var onProfile: ((String) -> Void)?
    @State private var profiles: [String] = []

    var body: some View {
        Group {
            if showsNavigationBar {
                NavigationStack(path: $profiles) {
                    content
                        .navigationDestination(for: String.self) { username in
                            MemberProfileView(session: session, username: username)
                        }
                        .navigationTitle("Find members")
                        .navigationBarTitleDisplayMode(.inline)
                }
            } else {
                content
            }
        }
    }

    private var content: some View {
        ComposeMemberSearch(
            state: state,
            session: session,
            onProfile: { username in
                if let onProfile { onProfile(username) }
                else if profiles.isEmpty { profiles.append(username) }
            }
        )
    }
}

@MainActor
private struct ComposeMemberSearch: UIViewControllerRepresentable {
    let state: MemberSearchState
    let session: MemberSessionStore
    let onProfile: (String) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        let api = TrustrootsAPI()
        let serverURL = session.serverURLString
        state.updateLanguages(value: TrustrootsLanguage.availableCodes.map {
            PilotSearchLanguage(code: $0, label: TrustrootsLanguage.displayName(for: $0))
        })
        return MemberSearchControllerKt.MemberSearchViewController(
            state: state,
            request: { query, filters, completion in
                let nativeFilters = MemberSearchFilters(
                    hosts: filters.hosts,
                    meetings: filters.meetings,
                    volunteering: filters.volunteering,
                    connectionsOnly: filters.connectionsOnly,
                    onlineRecently: filters.onlineRecently,
                    circleIDs: Set(filters.circleIDs),
                    languages: Set(filters.languages)
                )
                Task { @MainActor in
                    do {
                        let results = try await api.searchMembers(
                            serverURLString: serverURL,
                            query: query,
                            filters: nativeFilters
                        )
                        completion(results.map { member in
                            PilotSearchMember(
                                id: member.id,
                                username: member.username,
                                displayName: member.displayName,
                                location: member.locationSummary
                            )
                        }, nil)
                    } catch {
                        completion(nil, error.localizedDescription)
                    }
                }
            },
            loadCircles: { completion in
                Task { @MainActor in
                    do {
                        let circles = try await api.circles(serverURLString: serverURL).map {
                            PilotSearchCircle(id: $0.id, label: $0.label)
                        }
                        completion(circles, nil)
                    } catch {
                        completion(nil, error.localizedDescription)
                    }
                }
            },
            onProfile: onProfile
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
