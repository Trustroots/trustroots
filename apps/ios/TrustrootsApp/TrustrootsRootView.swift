import SwiftUI
import TrustrootsShared
import UIKit

struct TrustrootsRootView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var destination: TrustrootsDestination = .home
    @State private var browserRoute: TrustrootsBrowserRoute?
    @State private var messagesNavigationID = UUID()
    @State private var searchLocation: String?
    @State private var isKeyboardVisible = false
    @StateObject private var offlineAvailability = OfflineAvailability.shared

    var body: some View {
        VStack(spacing: 0) {
            OfflineSavedDataBanner(availability: offlineAvailability)

            Group {
                if let browserRoute {
                    TrustrootsBrowserView(route: browserRoute) {
                        self.browserRoute = nil
                    }
                } else {
                    switch destination {
                    case .home:
                        SharedHomeTab(session: session)
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
                    case .memberSearch:
                        MemberSearchView(session: session)
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
                            openBrowser: { browserRoute = $0 },
                            selectDestination: { destination = $0 }
                        )
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if !isKeyboardVisible {
                TrustrootsBottomNavigation(destination: $destination) { selectedDestination in
                    if destination == .search, selectedDestination == .search {
                        NotificationCenter.default.post(name: .trustrootsReturnToMap, object: nil)
                    }
                    browserRoute = nil
                    destination = selectedDestination
                    if selectedDestination == .messages {
                        messagesNavigationID = UUID()
                    }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(.systemBackground))
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
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            withAnimation(.easeOut(duration: 0.2)) {
                isKeyboardVisible = true
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.easeOut(duration: 0.2)) {
                isKeyboardVisible = false
            }
        }
        .task(id: analyticsPage?.path) {
            guard let analyticsPage else { return }
            await UmamiAnalytics.trackPage(analyticsPage)
        }
        .task(id: offlineAvailability.isUsingSavedData) {
            guard offlineAvailability.isUsingSavedData else { return }
            if await TrustrootsAPI().isServerReachable(serverURLString: session.serverURLString) {
                offlineAvailability.showLiveData()
            }
        }
    }

    private var analyticsPage: NativeAnalyticsPage? {
        guard browserRoute == nil else { return nil }
        return NativeAnalyticsPage(
            path: destination.analyticsPath,
            title: destination.label
        )
    }
}

struct BottomFilterField: View {
    let placeholder: String
    @Binding var text: String
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField(placeholder, text: $text)
                .focused($isFocused)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .onSubmit { isFocused = false }
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("Clear filter")
            }
        }
        .padding(.horizontal, 13)
        .frame(height: 44)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.regularMaterial)
        .overlay(alignment: .top) {
            Divider()
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    isFocused = false
                }
                .fontWeight(.semibold)
            }
        }
    }
}

extension Notification.Name {
    static let trustrootsOpenMapLocation = Notification.Name("trustroots.openMapLocation")
    static let trustrootsOpenWebsite = Notification.Name("trustroots.openWebsite")
    static let trustrootsOpenOwnProfile = Notification.Name("trustroots.openOwnProfile")
    static let trustrootsReturnToMap = Notification.Name("trustroots.returnToMap")
}

struct TrustrootsWebsiteLink {
    let url: URL
    let title: String
}

private enum TrustrootsDestination: CaseIterable {
    case home
    case circles
    case profile
    case editProfile
    case contacts
    case memberSearch
    case support
    case account
    case search
    case messages
    case menu

    var label: String {
        switch self {
        case .home: return "Home"
        case .circles: return "Circles"
        case .profile: return "Profile"
        case .editProfile: return "Edit profile"
        case .contacts: return "Contacts"
        case .memberSearch: return "Find members"
        case .support: return "Contact and support"
        case .account: return "Account"
        case .search: return "Search"
        case .messages: return "Messages"
        case .menu: return "Menu"
        }
    }

    var systemImage: String {
        switch self {
        case .home: return "house.fill"
        case .circles: return "person.2.fill"
        case .profile: return "person.2.fill"
        case .editProfile: return "pencil"
        case .contacts: return "person.2.fill"
        case .memberSearch: return "person.crop.circle.badge.magnifyingglass"
        case .support: return "questionmark.circle"
        case .account: return "person.crop.circle"
        case .search: return "magnifyingglass"
        case .messages: return "bubble.left.and.bubble.right.fill"
        case .menu: return "line.3.horizontal"
        }
    }

    var analyticsPath: String {
        switch self {
        case .home: return "/ios/home"
        case .circles: return "/ios/circles"
        case .profile: return "/ios/profile"
        case .editProfile: return "/ios/profile/edit"
        case .contacts: return "/ios/contacts"
        case .memberSearch: return "/ios/search/members"
        case .support: return "/ios/support"
        case .account: return "/ios/account"
        case .search: return "/ios/search"
        case .messages: return "/ios/messages"
        case .menu: return "/ios/menu"
        }
    }
}

private struct NativeAnalyticsPage {
    let path: String
    let title: String
}

private enum UmamiAnalytics {
    private static let endpoint = URL(string: "https://1p.trustroots.org/api/send")!
    private static let websiteID = "0c9e0ff2-3e20-4791-8588-8350bdf177cb"

    static func trackPage(_ page: NativeAnalyticsPage) async {
        struct Body: Encodable {
            struct Payload: Encodable {
                let hostname: String
                let language: String
                let url: String
                let website: String
                let title: String
            }

            let payload: Payload
            let type: String
        }

        let body = Body(
            payload: Body.Payload(
                hostname: "ios.trustroots.org",
                language: Locale.current.identifier,
                url: page.path,
                website: websiteID,
                title: page.title
            ),
            type: "event"
        )
        guard let encoded = try? JSONEncoder().encode(body) else { return }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.httpBody = encoded
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpCookieStorage = nil
        _ = try? await URLSession(configuration: configuration).data(for: request)
    }

    private static var userAgent: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        return "Trustroots-iOS/\(version)"
    }
}

private struct TrustrootsBottomNavigation: View {
    @Binding var destination: TrustrootsDestination
    @ScaledMetric(relativeTo: .caption2) private var labelSize: CGFloat = 9
    let selectDestination: (TrustrootsDestination) -> Void

    var body: some View {
        HStack(spacing: 0) {
            ForEach([TrustrootsDestination.home, .search, .messages, .menu], id: \.label) { item in
                Button {
                    selectDestination(item)
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: item.systemImage)
                            .font(.title3.weight(.semibold))
                            .frame(height: 22, alignment: .center)
                        Text(item.label)
                            .font(.system(size: labelSize, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .padding(.top, 3)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .top)
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
        .padding(.horizontal, 6)
        .padding(.top, 3)
        .background(Color(red: 0.08, green: 0.71, blue: 0.60).ignoresSafeArea(edges: .bottom))
    }
}

private struct MoreView: UIViewControllerRepresentable {
    let openBrowser: (TrustrootsBrowserRoute) -> Void
    let selectDestination: (TrustrootsDestination) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MemberMenuViewController(
            buildInfo: "iOS build: \(TrustrootsBuildInfo.formatted())",
            onSelect: open
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}

    private func open(_ action: MemberMenuAction) {
        switch action {
        case .profile:
            selectDestination(.profile)
        case .circles:
            selectDestination(.circles)
        case .contacts:
            selectDestination(.contacts)
        case .findmembers:
            selectDestination(.memberSearch)
        case .account:
            selectDestination(.account)
        case .support:
            selectDestination(.support)
        case .faq:
            openBrowser(.website(path: "/faq", title: "Frequently asked questions"))
        case .about:
            openBrowser(.website(path: "/about", title: "About Trustroots"))
        case .privacy:
            openBrowser(.website(path: "/privacy", title: "Privacy"))
        case .rules:
            openBrowser(.website(path: "/rules", title: "Rules"))
        case .statistics:
            openBrowser(.website(path: "/statistics", title: "Trustroots statistics"))
        default:
            break
        }
    }
}

#Preview {
    TrustrootsRootView(session: MemberSessionStore())
}

struct OfflineSavedDataBanner: View {
    @ObservedObject var availability: OfflineAvailability

    var body: some View {
        if availability.isUsingSavedData {
            HStack(spacing: 7) {
                Image(systemName: "wifi.slash")
                Text(message)
                    .lineLimit(1)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color(red: 0.36, green: 0.22, blue: 0.03))
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(red: 1.0, green: 0.90, blue: 0.68))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(message)
            .accessibilityIdentifier("offline-saved-data")
        }
    }

    private var message: String {
        guard let savedAt = availability.savedAt else {
            return "Offline — showing saved data"
        }
        return "Offline — saved \(savedAt.formatted(date: .abbreviated, time: .shortened))"
    }
}
