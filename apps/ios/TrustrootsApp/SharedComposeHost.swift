import Foundation
import MapKit
import SwiftUI
import TrustrootsShared

struct SharedComposeHost: UIViewControllerRepresentable {
    let session: MemberSessionStore
    let exit: () -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController(
            gateway: SharedMemberPilotGateway(session: session, exit: exit),
            username: session.member?.username,
            initialError: session.errorMessage,
            createConnectionsMap: { DashboardMapView(pins: $0) }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

struct SharedHomeTab: View {
    @ObservedObject var session: MemberSessionStore
    @State private var connection: ConnectionProfile?

    var body: some View {
        SharedHomeController(session: session) { username in
            connection = ConnectionProfile(id: username)
        }
        .id(session.member?.username)
        .sheet(item: $connection) { profile in
            NavigationStack {
                MemberProfileView(session: session, username: profile.id)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") { connection = nil }
                        }
                    }
            }
        }
    }

    private struct ConnectionProfile: Identifiable {
        let id: String
    }
}

private struct SharedHomeController: UIViewControllerRepresentable {
    let session: MemberSessionStore
    let openProfile: (String) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.SharedHomeViewController(
            gateway: SharedMemberPilotGateway(session: session, exit: {}),
            createConnectionsMap: { DashboardMapView(pins: $0) },
            openProfile: openProfile
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

@MainActor
private final class SharedMemberPilotGateway: NSObject, @preconcurrency PilotGateway {
    private let session: MemberSessionStore
    private let exitAction: () -> Void
    private let api = TrustrootsAPI()
    private let drafts = PilotMessageDraftStore()
    private var isActive = true

    init(session: MemberSessionStore, exit: @escaping () -> Void) {
        self.session = session
        self.exitAction = exit
    }

    func signIn(
        username: String,
        password: String,
        completion: @escaping (String?) -> Void
    ) {
        Task { @MainActor [weak self] in
            guard let self, isActive else { return }
            await session.signIn(usernameOrEmail: username, password: password)
            guard isActive else { return }
            completion(session.member == nil ? session.errorMessage : nil)
        }
    }

    func signOut(completion: @escaping (String?) -> Void) {
        Task { @MainActor [weak self] in
            guard let self, isActive else { return }
            await session.signOut()
            guard isActive else { return }
            completion(nil)
        }
    }

    func featuredNotes(completion: @escaping ([PilotNote]?, String?) -> Void) {
        let api = api
        let serverURL = session.serverURLString
        perform(account: session.member?.username, completion: completion) {
            try await api.featuredNotes(serverURLString: serverURL)
        } map: { notes in
            notes.map { note in
                PilotNote(content: note.content, authorUsername: note.authorUsername, publishedAt: note.publishedAt)
            }
        }
    }

    func connections(completion: @escaping (PilotConnections?, String?) -> Void) {
        let api = api
        let serverURL = session.serverURLString
        perform(account: session.member?.username, completion: completion) {
            try await api.dashboardConnections(serverURLString: serverURL)
        } map: { connections in
            let hosts = connections.hosts.compactMap { Self.mapPin($0, hosting: true) }
            let meetings = (connections.meetings ?? []).compactMap { Self.mapPin($0, hosting: false) }
            return PilotConnections(recent: connections.recent.map(Self.dashboardMember), pins: hosts + meetings)
        }
    }

    private static func dashboardMember(_ connection: DashboardConnection) -> PilotConnection {
        PilotConnection(
            username: connection.username,
            name: displayText(connection.displayName, fallback: connection.username),
            activity: connection.activity
        )
    }

    private static func mapPin(_ connection: DashboardConnection, hosting: Bool) -> PilotMapPin? {
        guard let location = connection.location, location.count == 2,
              location[0].isFinite, (-85...85).contains(location[0]),
              location[1].isFinite, (-180...180).contains(location[1]) else { return nil }
        return PilotMapPin(
            connection: dashboardMember(connection),
            latitude: location[0],
            longitude: location[1],
            hosting: hosting
        )
    }

    func profile(
        username: String,
        completion: @escaping (PilotProfile?, String?) -> Void
    ) {
        let account = session.member?.username
        let api = api
        let serverURL = session.serverURLString
        perform(account: account, completion: completion) {
            try await api.profile(serverURLString: serverURL, username: username)
        } map: { profile in
            PilotProfile(
                person: PilotPerson(
                    id: profile.id,
                    username: profile.username,
                    name: Self.displayText(profile.displayName, fallback: profile.username)
                ),
                tagline: Self.optionalDisplayText(profile.tagline),
                location: Self.optionalDisplayText(profile.locationLiving),
                about: Self.optionalDisplayText(profile.description)
            )
        }
    }

    func inbox(
        page: Int32,
        completion: @escaping ([PilotThread]?, String?) -> Void
    ) {
        let account = session.member?.username
        let api = api
        let serverURL = session.serverURLString
        perform(account: account, completion: completion) {
            try await api.inbox(serverURLString: serverURL, page: Int(page))
        } map: { threads in
            threads.map { thread in
                let member = thread.otherMember(excluding: account)
                let username = Self.optionalDisplayText(member.username)
                return PilotThread(
                    id: thread.id,
                    partner: PilotPerson(
                        id: member.id,
                        username: username,
                        name: Self.displayText(member.displayName, fallback: username ?? "Member")
                    ),
                    excerpt: Self.displayText(thread.message.excerpt, fallback: "")
                )
            }
        }
    }

    func conversation(
        memberId: String,
        completion: @escaping ([PilotMessage]?, String?) -> Void
    ) {
        let account = session.member?.username
        let api = api
        let serverURL = session.serverURLString
        perform(account: account, completion: completion) {
            try await api.conversation(serverURLString: serverURL, memberID: memberId)
        } map: { messages in
            messages.map { message in
                PilotMessage(
                    id: message.id,
                    author: Self.displayText(message.userFrom.displayName, fallback: message.userFrom.username ?? "Member"),
                    content: Self.displayText(message.content, fallback: ""),
                    outgoing: message.isFrom(username: account)
                )
            }
        }
    }

    func send(
        memberId: String,
        content: String,
        completion: @escaping (PilotMessage?, String?) -> Void
    ) {
        let account = session.member?.username
        let api = api
        let serverURL = session.serverURLString
        perform(account: account, completion: completion) {
            try await api.sendMessage(
                serverURLString: serverURL,
                memberID: memberId,
                content: content
            )
        } map: { message in
            PilotMessage(
                id: message.id,
                author: Self.displayText(message.userFrom.displayName, fallback: message.userFrom.username ?? "Member"),
                content: Self.displayText(message.content, fallback: ""),
                outgoing: message.isFrom(username: account)
            )
        }
    }

    func loadDraft(partner: PilotPerson) -> String {
        guard let key = draftKey(for: partner) else { return "" }
        return drafts.load(key)
    }

    func saveDraft(partner: PilotPerson, value: String) {
        guard let key = draftKey(for: partner) else { return }
        try? drafts.save(value, for: key)
    }

    func exit() {
        isActive = false
        exitAction()
    }

    private func perform<Value, Output>(
        account: String?,
        completion: @escaping (Output?, String?) -> Void,
        operation: @escaping () async throws -> Value,
        map: @escaping (Value) -> Output
    ) {
        Task { @MainActor [weak self] in
            guard let self, isActive else { return }
            do {
                let value = try await operation()
                guard isActive, session.member?.username == account else { return }
                completion(map(value), nil)
            } catch is CancellationError {
                return
            } catch let error as URLError where error.code == .cancelled {
                return
            } catch {
                guard isActive, session.member?.username == account else { return }
                completion(nil, error.localizedDescription)
            }
        }
    }

    private func draftKey(for partner: PilotPerson) -> PilotMessageDraftStore.Key? {
        guard isActive, let username = session.member?.username,
              let recipientID = partner.id, !recipientID.isEmpty,
              let server = TrustrootsAPIConfiguration(baseURLString: session.serverURLString) else { return nil }
        return .init(server: server.normalizedURLString, username: username, recipientID: recipientID)
    }

    private static func optionalDisplayText(_ value: String?) -> String? {
        guard let value else { return nil }
        let cleaned = TrustrootsRichText.plainText(value).trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? nil : cleaned
    }

    private static func displayText(_ value: String?, fallback: String) -> String {
        optionalDisplayText(value) ?? fallback
    }
}

private final class DashboardMapAnnotation: MKPointAnnotation {
    let hosting: Bool

    init(pin: PilotMapPin) {
        hosting = pin.hosting
        super.init()
        coordinate = CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude)
        title = pin.connection.name
        subtitle = hosting ? "Hosting" : "Happy to meet"
    }
}

private final class DashboardMapView: MKMapView, MKMapViewDelegate {
    private var needsInitialViewport = true

    init(pins: [PilotMapPin]) {
        super.init(frame: .zero)
        delegate = self
        register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: "connection")
        addAnnotations(pins.map(DashboardMapAnnotation.init(pin:)))
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard needsInitialViewport, bounds.width > 0, bounds.height > 0 else { return }
        needsInitialViewport = false
        if let first = annotations.first, annotations.count == 1 {
            let region = MKCoordinateRegion(
                center: first.coordinate,
                latitudinalMeters: 20_000,
                longitudinalMeters: 20_000
            )
            setRegion(region, animated: false)
        } else {
            showAnnotations(annotations, animated: false)
        }
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard let pin = annotation as? DashboardMapAnnotation,
              let marker = mapView.dequeueReusableAnnotationView(withIdentifier: "connection", for: pin)
                as? MKMarkerAnnotationView else { return nil }
        marker.markerTintColor = pin.hosting ? .systemTeal : .systemOrange
        marker.glyphImage = UIImage(systemName: pin.hosting ? "house" : "person.2")
        marker.canShowCallout = true
        marker.accessibilityLabel = [pin.title, pin.subtitle].compactMap { $0 }.joined(separator: ", ")
        return marker
    }
}
