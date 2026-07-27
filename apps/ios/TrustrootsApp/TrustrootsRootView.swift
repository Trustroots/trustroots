import SwiftUI

struct TrustrootsRootView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var destination: TrustrootsDestination = .profile
    @State private var browserRoute: TrustrootsBrowserRoute?
    @State private var messagesNavigationID = UUID()
    @State private var searchLocation: String?
    @StateObject private var offlineAvailability = OfflineAvailability.shared

    var body: some View {
        VStack(spacing: 0) {
            TrustrootsTopNavigation(destination: $destination) { selectedDestination in
                browserRoute = nil
                destination = selectedDestination
                if selectedDestination == .messages {
                    messagesNavigationID = UUID()
                }
            }

            if offlineAvailability.isUsingSavedData {
                HStack(spacing: 7) {
                    Image(systemName: "wifi.slash")
                    Text(offlineWarning)
                        .lineLimit(1)
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color(red: 0.36, green: 0.22, blue: 0.03))
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(red: 1.0, green: 0.90, blue: 0.68))
                .accessibilityLabel(offlineWarning)
            }

            if let browserRoute {
                TrustrootsBrowserView(route: browserRoute) {
                    self.browserRoute = nil
                }
            } else {
                switch destination {
                case .circles:
                    CirclesView(session: session)
                case .profile:
                    MemberProfileView(session: session, editProfile: {
                        destination = .editProfile
                    }, openCircles: {
                        destination = .circles
                    })
                case .editProfile:
                    EditProfileView(
                        session: session,
                        onSaved: { destination = .profile },
                        onCancel: { destination = .profile }
                    )
                case .contacts:
                    ContactsView(session: session)
                case .support:
                    ContactSupportView(session: session) {
                        browserRoute = .website(path: "/faq", title: "Frequently asked questions")
                    }
                case .account:
                    AccountView(
                        session: session,
                        openPasswordRecovery: { browserRoute = .passwordRecovery }
                    )
                case .search:
                    OfferMapView(session: session, searchLocation: searchLocation)
                case .messages:
                    MessageInboxView(session: session)
                        .id(messagesNavigationID)
                case .menu:
                    MoreView(
                        session: session,
                        openBrowser: { browserRoute = $0 },
                        selectDestination: { destination = $0 }
                    )
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(.systemBackground))
        .ignoresSafeArea(edges: .top)
        .statusBar(hidden: true)
        .tint(TrustrootsPalette.darkGreen)
        .onReceive(NotificationCenter.default.publisher(for: .trustrootsOpenMapLocation)) { notification in
            guard let location = notification.object as? String else { return }
            browserRoute = nil
            searchLocation = location
            destination = .search
        }
        .onReceive(NotificationCenter.default.publisher(for: .trustrootsOpenWebsite)) { notification in
            guard let payload = notification.object as? TrustrootsWebsiteLink else { return }
            browserRoute = .website(path: payload.url.absoluteString, title: payload.title)
        }
        .onReceive(NotificationCenter.default.publisher(for: .trustrootsOpenOwnProfile)) { _ in
            browserRoute = nil
            destination = .profile
        }
        .onReceive(NotificationCenter.default.publisher(for: .trustrootsOpenAPIDiagnostics)) { _ in
            browserRoute = nil
            destination = .menu
        }
        .task(id: offlineAvailability.isUsingSavedData) {
            guard offlineAvailability.isUsingSavedData else { return }
            if await TrustrootsAPI().isServerReachable(serverURLString: session.serverURLString) {
                offlineAvailability.showLiveData()
            }
        }
    }

    private var offlineWarning: String {
        guard let savedAt = offlineAvailability.savedAt else {
            return "Offline — showing saved data"
        }
        return "Offline — saved \(savedAt.formatted(date: .abbreviated, time: .shortened))"
    }
}

extension Notification.Name {
    static let trustrootsOpenMapLocation = Notification.Name("trustroots.openMapLocation")
    static let trustrootsOpenWebsite = Notification.Name("trustroots.openWebsite")
    static let trustrootsOpenOwnProfile = Notification.Name("trustroots.openOwnProfile")
    static let trustrootsOpenAPIDiagnostics = Notification.Name("trustroots.openAPIDiagnostics")
}

struct TrustrootsWebsiteLink {
    let url: URL
    let title: String
}

private enum TrustrootsDestination: CaseIterable {
    case circles
    case profile
    case editProfile
    case contacts
    case support
    case account
    case search
    case messages
    case menu

    var label: String {
        switch self {
        case .circles: return "Circles"
        case .profile: return "Profile"
        case .editProfile: return "Edit profile"
        case .contacts: return "Contacts"
        case .support: return "Contact and support"
        case .account: return "Account"
        case .search: return "Search"
        case .messages: return "Messages"
        case .menu: return "Menu"
        }
    }

    var systemImage: String {
        switch self {
        case .circles: return "person.2.fill"
        case .profile: return "person.2.fill"
        case .editProfile: return "pencil"
        case .contacts: return "person.2.fill"
        case .support: return "questionmark.circle"
        case .account: return "person.crop.circle"
        case .search: return "magnifyingglass"
        case .messages: return "bubble.left.and.bubble.right.fill"
        case .menu: return "line.3.horizontal"
        }
    }

    static let navigationItems: [TrustrootsDestination] = [
        .circles,
        .search,
        .messages,
        .menu,
    ]
}

private struct TrustrootsTopNavigation: View {
    @Binding var destination: TrustrootsDestination
    let selectDestination: (TrustrootsDestination) -> Void

    var body: some View {
        HStack(spacing: 0) {
            navigationButtons(Array(TrustrootsDestination.navigationItems.prefix(2)))
            Color.clear.frame(width: 130)
            navigationButtons(Array(TrustrootsDestination.navigationItems.suffix(2)))
        }
        .padding(.horizontal, 6)
        .padding(.top, 8)
        .frame(height: 76, alignment: .top)
        .background(Color(red: 0.08, green: 0.71, blue: 0.60).ignoresSafeArea(edges: .top))
    }

    @ViewBuilder
    private func navigationButtons(_ items: [TrustrootsDestination]) -> some View {
        HStack(spacing: 0) {
            ForEach(items, id: \.label) { item in
                Button {
                    selectDestination(item)
                } label: {
                    Image(systemName: item.systemImage)
                        .font(.title3.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(.white)
                        .background {
                            if item == destination {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(
                                        LinearGradient(
                                            colors: [.black.opacity(0.24), .black.opacity(0.10)],
                                            startPoint: .top,
                                            endPoint: .bottom
                                        )
                                    )
                            }
                        }
                }
                .accessibilityLabel(item.label)
                .accessibilityAddTraits(item == destination ? .isSelected : [])
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MoreView: View {
    @ObservedObject var session: MemberSessionStore
    let openBrowser: (TrustrootsBrowserRoute) -> Void
    let selectDestination: (TrustrootsDestination) -> Void
    private let api = TrustrootsAPI()
    @State private var apiDiagnostic = APIServerDiagnostic.checking
    @State private var diagnosticCheckedAt: Date?
    @State private var apiStatus: MobileAPIStatus?

    var body: some View {
        NavigationStack {
            List {
                Button("My profile") {
                    selectDestination(.profile)
                }
                Button("Contacts") {
                    selectDestination(.contacts)
                }
                Button("Account") {
                    selectDestination(.account)
                }

                Section("Help") {
                    Button("Frequently asked questions") {
                        openBrowser(.website(path: "/faq", title: "Frequently asked questions"))
                    }
                    Button("Contact and support") {
                        selectDestination(.support)
                    }
                }

                Section("Trustroots") {
                    Button("About") {
                        openBrowser(.website(path: "/", title: "About Trustroots"))
                    }
                    Button("Privacy") {
                        openBrowser(.website(path: "/privacy", title: "Privacy"))
                    }
                    Button("Rules") {
                        openBrowser(.website(path: "/rules", title: "Rules"))
                    }
                    Button("Statistics") {
                        openBrowser(.website(path: "/statistics", title: "Trustroots statistics"))
                    }
                }

                Section {
                    VStack(spacing: 8) {
                        Image("TrustrootsLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 70)
                        Text("Travellers’ community")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(TrustrootsPalette.darkGreen)
                        Text("Sharing, hosting and getting people together.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                        Text("API: \(normalizedServerURL)")
                            .font(.caption2.monospaced())
                            .foregroundStyle(TrustrootsPalette.darkGreen.opacity(0.78))
                            .multilineTextAlignment(.center)
                            .textSelection(.enabled)
                        if let apiStatus {
                            Text("API build: \(apiStatus.buildVersion)")
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                            if let revision = apiStatus.revision {
                                Text("Revision: \(revision)")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Divider()
                            .overlay(TrustrootsPalette.green.opacity(0.22))
                        HStack(alignment: .top, spacing: 9) {
                            Image(systemName: apiDiagnostic.systemImage)
                                .foregroundStyle(apiDiagnostic.colour)
                                .frame(width: 18)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(apiDiagnostic.title)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.primary)
                                Text(apiDiagnostic.detail)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let diagnosticCheckedAt {
                                    Text("Checked \(diagnosticCheckedAt.formatted(date: .omitted, time: .shortened))")
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer(minLength: 0)
                            Button {
                                Task { await checkAPI() }
                            } label: {
                                Image(systemName: "arrow.clockwise")
                            }
                            .buttonStyle(.borderless)
                            .disabled(apiDiagnostic == .checking)
                            .accessibilityLabel("Check API server again")
                        }
                        Text("iOS build: \(TrustrootsBuildInfo.formatted())")
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .listRowBackground(TrustrootsPalette.paleGreen)
                }

            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await checkAPI()
        }
    }

    private var normalizedServerURL: String {
        TrustrootsAPIConfiguration(baseURLString: session.serverURLString)?.normalizedURLString
            ?? session.serverURLString
    }

    @MainActor
    private func checkAPI() async {
        apiDiagnostic = .checking
        async let diagnostic = api.diagnoseServer(serverURLString: session.serverURLString)
        async let status = try? api.status(serverURLString: session.serverURLString)
        apiDiagnostic = await diagnostic
        apiStatus = await status
        diagnosticCheckedAt = .now
        if apiDiagnostic.isUsable {
            OfflineAvailability.shared.showLiveData()
        }
    }
}

#Preview {
    TrustrootsRootView(session: MemberSessionStore())
}
