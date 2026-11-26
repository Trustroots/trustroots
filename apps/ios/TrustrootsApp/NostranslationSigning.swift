import Foundation
import CryptoKit
import SwiftUI
import TrustrootsShared
import UserNotifications
import VisionKit

struct NostranslationLink {
    static let clientURL = "https://team.trustroots.org/nostranslation"
    static let relay = "wss://relay.trustroots.org"
    let peer: String
    let secret: String

    init?(_ input: String) {
        let input = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard input.utf8.count <= 2_048, let url = URLComponents(string: input),
              url.scheme?.lowercased() == "nostrconnect",
              url.user == nil, url.password == nil, url.port == nil, url.path.isEmpty, url.fragment == nil,
              let peer = url.host, peer.wholeMatch(of: #/[a-f0-9]{64}/#) != nil,
              let items = url.queryItems else { return nil }
        var values: [String: String] = [:]
        for item in items {
            guard ["relay", "url", "perms", "secret", "name"].contains(item.name),
                  values[item.name] == nil, let value = item.value else { return nil }
            values[item.name] = value
        }
        guard values["relay"] == Self.relay, values["url"] == Self.clientURL,
              values["perms"] == "sign_event:27235", let secret = values["secret"],
              secret.wholeMatch(of: #/[a-zA-Z0-9_-]{1,128}/#) != nil else { return nil }
        self.peer = peer
        self.secret = secret
    }
}

@MainActor
final class NostranslationSigner: ObservableObject {
    struct Client: Codable, Equatable, Identifiable {
        var id: String { peer }
        let peer: String
        let transportSecret: String
        let signingKey: String
    }

    struct Review: Identifiable {
        var id: String { peer + ":" + request }
        let peer: String
        let request: String
        let approval: NostranslationApproval
    }

    private struct Event: Decodable {
        let id: String
        let pubkey: String
        let created_at: Int
        let kind: Int
        let tags: [[String]]
        let content: String
        let sig: String
    }

    private struct Unsigned: Decodable {
        let created_at: Int64
        let kind: Int32
        let tags: [[String]]
        let content: String
    }

    private final class Connection {
        let client: Client
        let policy: NostranslationPairing
        let transportPublicKey: String
        let socket: URLSessionWebSocketTask
        let subscription = UUID().uuidString
        var handshake: String?
        var task: Task<Void, Never>?
        var earlyEvents: [[Any]] = []

        init(client: Client, scope: NostrAccountScope, socket: URLSessionWebSocketTask) throws {
            self.client = client
            self.socket = socket
            transportPublicKey = try NostrCrypto.publicKey(secret: client.transportSecret)
            policy = NostranslationPairing(account: scope, clientPublicKey: client.peer, signingPublicKey: client.signingKey)
        }
    }

    @Published private(set) var clients: [Client] = []
    @Published private(set) var reviews: [Review] = []
    @Published var error: String?
    private let identity: NostrIdentityManager
    private let keyStore = NostrKeyStore()
    private let policySession = NostrSigningSession()
    private var revision: Int64 = 0
    private var connections: [String: Connection] = [:]
    private var seen: [String: Int] = [:]
    private var now: Int { Int(Date().timeIntervalSince1970) }
    private var publicKey: String? {
        identity.isCurrent(revision) && policySession.scope != nil ? identity.publicKey : nil
    }

    init(identity: NostrIdentityManager = .shared) { self.identity = identity }

    func start() throws {
        guard let scope = identity.accountScope, let publicKey = identity.publicKey else { throw NostrIdentityError.missingKey }
        revision = identity.revision
        _ = policySession.activate(account: scope)
        if let record = try keyStore.read(account: NostrIdentityManager.pairingAccount(scope.storageAccount)) {
            clients = try JSONDecoder().decode([Client].self, from: Data(record.utf8)).filter { $0.signingKey == publicKey }
        }
        for client in clients { try connect(client) }
    }

    func recoverPending(server: String) async {
        let api = TrustrootsAPI()
        for client in clients {
            guard !Task.isCancelled else { return }
            guard let connection = connections[client.peer],
                  let events = try? await api.pendingTranslationAlerts(
                    serverURLString: server, transport: connection.transportPublicKey
                  ),
                  !Task.isCancelled, isCurrent(connection) else { continue }
            for event in events.prefix(8) {
                try? await receive(["EVENT", connection.subscription, event], connection: connection)
            }
        }
    }

    func pair(_ link: NostranslationLink) throws {
        let knownPeers = Set(clients.map(\.peer)).union(connections.keys)
        guard let publicKey, knownPeers.count < 8, !knownPeers.contains(link.peer) else {
            throw NostrIdentityError.inactiveSession
        }
        let client = Client(peer: link.peer, transportSecret: try NostrKeyCodec.generateSecret(), signingKey: publicKey)
        try connect(client, pairingSecret: link.secret)
    }

    func revoke(_ client: Client) throws {
        try save(clients.filter { $0 != client })
        reviews.filter { $0.peer == client.peer }.forEach { $0.approval.deny() }
        reviews.removeAll { $0.peer == client.peer }
        disconnect(client.peer)
    }

    func decide(_ review: Review, approved: Bool) async throws {
        guard reviews.contains(where: { $0.id == review.id }) else { return }
        reviews.removeAll { $0.id == review.id }
        guard let publicKey, let connection = connections[review.peer] else { return }
        if approved, let event = review.approval.approve(now: Int64(now), localPublicKey: publicKey), let secret = identity.secret() {
            let signed = try NIP07Bridge.sign(event: [
                "created_at": event.createdAt, "kind": event.kind, "tags": event.tags, "content": event.content
            ], secret: secret)
            try await reply(connection, id: review.request, field: "result", value: Self.json(signed))
        } else {
            review.approval.deny()
            let reason = approved ? "Authorisation expired. Retry in Nostranslation." : "Authorisation denied."
            try await reply(connection, id: review.request, field: "error", value: reason)
        }
    }

    private func connect(_ client: Client, pairingSecret: String? = nil) throws {
        guard let scope = policySession.scope, let relay = URL(string: NostranslationLink.relay) else {
            throw NostrIdentityError.inactiveSession
        }
        let socket = URLSession.shared.webSocketTask(with: relay)
        socket.maximumMessageSize = 32_768
        let connection = try Connection(client: client, scope: scope, socket: socket)
        connections[client.peer] = connection
        socket.resume()
        connection.task = Task { [weak self, weak connection] in
            do {
                try await self?.subscribe(connection, pairingSecret: pairingSecret)
                while !Task.isCancelled {
                    let message = try await socket.receive()
                    guard let self, let connection, self.isCurrent(connection) else { return }
                    if case let .string(text) = message,
                       let frame = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [Any] {
                        try await self.receive(frame, connection: connection)
                    }
                }
            } catch {
                guard let self, let connection, self.isCurrent(connection) else { return }
                self.disconnect(client.peer)
                self.error = "The relay connection failed. Close and reopen this screen to retry."
            }
        }
    }

    private func subscribe(_ connection: Connection?, pairingSecret: String?) async throws {
        guard let connection, isCurrent(connection) else { return }
        try await send(connection, frame: ["REQ", connection.subscription, [
            "kinds": [24133], "authors": [connection.client.peer],
            "#p": [connection.transportPublicKey], "since": now - 60
        ]])
        if let pairingSecret {
            let handshake = try envelope(connection, rpc: ["id": UUID().uuidString, "result": pairingSecret])
            connection.handshake = handshake["id"] as? String
            try await send(connection, frame: ["EVENT", handshake])
        }
    }

    private func receive(_ frame: [Any], connection: Connection) async throws {
        guard frame.count >= 3, let type = frame[0] as? String, let id = frame[1] as? String, isCurrent(connection) else { return }
        let peer = connection.client.peer
        if type == "OK", id == connection.handshake {
            guard frame[2] as? Bool == true else { throw NostrIdentityError.invalidKey }
            try save(clients + [connection.client])
            connection.handshake = nil
            let waiting = connection.earlyEvents
            connection.earlyEvents.removeAll()
            for event in waiting { try await receive(event, connection: connection) }
            return
        }
        guard type == "EVENT", id == connection.subscription else { return }
        guard clients.contains(connection.client) else {
            if connection.handshake != nil, connection.earlyEvents.count < 8 { connection.earlyEvents.append(frame) }
            return
        }
        guard let key = publicKey, let request = try? decode(frame[2], connection: connection),
              let rpcID = request["id"] as? String, rpcID.wholeMatch(of: #/[a-zA-Z0-9_.:-]{1,128}/#) != nil,
              let method = request["method"] as? String, let params = request["params"] as? [Any] else { return }
        seen = seen.filter { $0.value >= now - 120 }
        let seenID = peer + ":" + rpcID
        guard seen[seenID] == nil, seen.count < 256 else { return }
        seen[seenID] = now
        switch method {
        case "connect" where (1...4).contains(params.count) && params.first as? String == connection.transportPublicKey:
            try await reply(connection, id: rpcID, field: "result", value: "ack")
        case "get_public_key" where params.isEmpty:
            try await reply(connection, id: rpcID, field: "result", value: key)
        case "sign_event" where params.count == 1:
            reviews.removeAll { $0.approval.expiresAt < Int64(now) }
            if let text = params[0] as? String,
               let event = try? JSONDecoder().decode(Unsigned.self, from: Data(text.utf8)),
               let approval = connection.policy.prepareReview(
                session: policySession, authenticatedPeer: peer, localPublicKey: key,
                kind: event.kind, createdAt: event.created_at, content: event.content, tags: event.tags, now: Int64(now)
               ), reviews.count < 8 {
                reviews.append(Review(peer: peer, request: rpcID, approval: approval))
                return
            }
            try await reply(connection, id: rpcID, field: "error", value: "Authorisation unavailable. Retry in Nostranslation.")
        default:
            try await reply(connection, id: rpcID, field: "error", value: "Unsupported method.")
        }
    }

    private func decode(_ object: Any, connection: Connection) throws -> [String: Any] {
        let event = try JSONDecoder().decode(Event.self, from: JSONSerialization.data(withJSONObject: object, options: [.fragmentsAllowed]))
        guard event.kind == 24133, event.pubkey == connection.client.peer,
              event.tags == [["p", connection.transportPublicKey]], (now - 300...now + 30).contains(event.created_at),
              (132...22_000).contains(event.content.utf8.count),
              try NIP07Bridge.eventID(publicKey: event.pubkey, createdAt: event.created_at,
                                      kind: event.kind, tags: event.tags, content: event.content) == event.id else {
            throw NostrIdentityError.invalidKey
        }
        try NostrCrypto.verifyEventID(event.id, signature: event.sig, publicKey: event.pubkey)
        let plaintext = try NostrCrypto.nip44Decrypt(event.content, secret: connection.client.transportSecret, peer: event.pubkey)
        guard let rpc = try JSONSerialization.jsonObject(with: Data(plaintext.utf8)) as? [String: Any] else {
            throw NostrIdentityError.invalidKey
        }
        return rpc
    }

    private func reply(_ connection: Connection, id: String, field: String, value: String) async throws {
        let event = try envelope(connection, rpc: ["id": id, field: value])
        try await send(connection, frame: ["EVENT", event])
    }

    private func envelope(_ connection: Connection, rpc: [String: String]) throws -> [String: Any] {
        let client = connection.client
        let ciphertext = try NostrCrypto.nip44Encrypt(Self.json(rpc), secret: client.transportSecret, peer: client.peer)
        return try NIP07Bridge.sign(event: [
            "kind": 24133, "created_at": now, "tags": [["p", client.peer]], "content": ciphertext
        ], secret: client.transportSecret)
    }

    private func send(_ connection: Connection, frame: [Any]) async throws {
        guard isCurrent(connection) else { throw NostrIdentityError.inactiveSession }
        try await connection.socket.send(.string(Self.json(frame)))
    }

    private func isCurrent(_ connection: Connection) -> Bool {
        connections[connection.client.peer] === connection && publicKey == connection.client.signingKey
    }

    private func save(_ next: [Client]) throws {
        guard publicKey != nil, let scope = policySession.scope else { throw NostrIdentityError.inactiveSession }
        let encoded = String(decoding: try JSONEncoder().encode(next), as: UTF8.self)
        try keyStore.update(secret: encoded, account: NostrIdentityManager.pairingAccount(scope.storageAccount))
        clients = next
    }

    private func disconnect(_ peer: String) {
        guard let connection = connections.removeValue(forKey: peer) else { return }
        connection.policy.revoke()
        connection.task?.cancel()
        connection.socket.cancel(with: .normalClosure, reason: nil)
    }

    func stop() {
        policySession.pause()
        reviews.forEach { $0.approval.deny() }
        reviews.removeAll()
        for peer in Array(connections.keys) { disconnect(peer) }
        clients.removeAll()
    }

    private static func json(_ value: Any) throws -> String {
        String(decoding: try JSONSerialization.data(withJSONObject: value, options: [.withoutEscapingSlashes]), as: UTF8.self)
    }
}

struct NostranslationSigningSheet: View {
    let serverURLString: String
    var openedFromAlert = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject private var identity = NostrIdentityManager.shared
    @ObservedObject private var alerts = NostranslationDeviceAlerts.shared
    @StateObject private var signer = NostranslationSigner()
    @State private var input = ""
    @State private var link: NostranslationLink?
    @State private var showScanner = false

    var body: some View {
        NavigationStack {
            Form {
                if let review = signer.reviews.first {
                    Section("Authorise a translation review") {
                        Text(review.approval.destination)
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            let expired = Int64(context.date.timeIntervalSince1970) > review.approval.expiresAt
                            if expired { Text("This request expired. Retry in Nostranslation.") }
                            Button("Approve signature") { decide(review, approved: true) }.disabled(expired)
                            Button(expired ? "Dismiss" : "Deny", role: .destructive) { decide(review, approved: false) }
                        }
                    }
                }
                Section("Connect a client") {
                    TextField("Nostranslation connection link", text: $input)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .privacySensitive()
                    Button("Review connection") { reviewLink(input) }.disabled(input.isEmpty)
                    if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                        Button("Scan QR code") { showScanner = true }
                    }
                    if let link {
                        Text(NostranslationLink.clientURL)
                        Text(NostranslationLink.relay)
                        Button("Pair with Nostranslation") {
                            perform { try signer.pair(link) }
                            self.link = nil
                            input = ""
                        }
                        Button("Cancel", role: .cancel) { self.link = nil }
                    }
                }
                if !signer.clients.isEmpty {
                    Section("Connected clients") {
                        ForEach(signer.clients) { client in
                            NostrConnectedClientRow(peerPrefix: String(client.peer.prefix(12))) {
                                guard signer.clients.contains(client) else { return }
                                perform { try signer.revoke(client) }
                            }
                        }
                    }
                    Section("Review alerts") {
                        NostrReviewAlertsSection(enabled: alerts.enabled, status: alerts.status) {
                            Task { await alerts.setEnabled(!alerts.enabled, server: serverURLString) }
                        }
                    }
                }
                if openedFromAlert && signer.reviews.isEmpty {
                    Text("If the request has expired, retry in Nostranslation.")
                }
                if let error = signer.error { Text(error).foregroundStyle(.secondary) }
            }
            .navigationTitle("Nostranslation signing")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .task {
            perform { try signer.start() }
            if openedFromAlert && alerts.enabled {
                await signer.recoverPending(server: serverURLString)
            }
        }
        .onDisappear { signer.stop() }
        .onChange(of: signer.clients) { _, _ in alerts.reconcile(server: serverURLString) }
        .sheet(isPresented: $showScanner) {
            NavigationStack {
                NostranslationQRScanner { input in
                    showScanner = false
                    reviewLink(input)
                } onUnavailable: {
                    showScanner = false
                    signer.error = "The camera is unavailable. Paste the connection link instead."
                }
                .navigationTitle("Scan Nostranslation QR code")
                .toolbar { Button("Cancel") { showScanner = false } }
            }
        }
        .onChange(of: identity.revision) { _, _ in dismiss() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { dismiss() }
        }
    }

    private func reviewLink(_ input: String) {
        link = NostranslationLink(input)
        signer.error = link == nil ? "Enter a valid Nostranslation connection link." : nil
    }

    private func decide(_ review: NostranslationSigner.Review, approved: Bool) {
        Task {
            do { try await signer.decide(review, approved: approved) }
            catch { signer.error = "The response could not be sent. Retry in Nostranslation." }
        }
    }

    private func perform(_ action: () throws -> Void) {
        signer.error = nil
        do { try action() }
        catch { signer.error = "This action could not be completed. Check your local Nostr key and try again." }
    }
}

private struct NostrConnectedClientRow: View {
    let peerPrefix: String
    let onRevoke: () -> Void
    @State private var height: CGFloat = 1

    var body: some View {
        Controller(peerPrefix: peerPrefix, onRevoke: onRevoke, height: $height)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipped()
    }

    @MainActor
    private struct Controller: UIViewControllerRepresentable {
        let peerPrefix: String
        let onRevoke: () -> Void
        @Binding var height: CGFloat

        final class Coordinator {
            var onRevoke: () -> Void = {}
        }

        func makeCoordinator() -> Coordinator { Coordinator() }

        func makeUIViewController(context: Context) -> UIViewController {
            let coordinator = context.coordinator
            coordinator.onRevoke = onRevoke
            let measuredHeight = $height
            return NostrConnectedClientControllerKt.NostrConnectedClientViewController(
                peerPrefix: peerPrefix,
                onRevoke: { [weak coordinator] in coordinator?.onRevoke() },
                onHeight: { value in
                    let next = max(1, CGFloat(value.doubleValue))
                    Task { @MainActor in
                        if measuredHeight.wrappedValue != next {
                            measuredHeight.wrappedValue = next
                        }
                    }
                }
            )
        }

        func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
            context.coordinator.onRevoke = onRevoke
        }
    }
}

private struct NostrReviewAlertsSection: View {
    let enabled: Bool
    let status: String?
    let onToggle: () -> Void
    @State private var height: CGFloat = 1

    var body: some View {
        NostrReviewAlertsController(enabled: enabled, status: status, onToggle: onToggle, height: $height)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipped()
    }
}

@MainActor
private struct NostrReviewAlertsController: UIViewControllerRepresentable {
    let enabled: Bool
    let status: String?
    let onToggle: () -> Void
    @Binding var height: CGFloat

    final class Coordinator {
        let state = NostrReviewAlertsState()
        var onToggle: (() -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let measuredHeight = $height
        return NostrReviewAlertsControllerKt.NostrReviewAlertsViewController(
            state: coordinator.state,
            onToggle: { [weak coordinator] in coordinator?.onToggle?() },
            onHeight: { value in
                let next = max(1, CGFloat(value.doubleValue))
                Task { @MainActor in
                    if measuredHeight.wrappedValue != next {
                        measuredHeight.wrappedValue = next
                    }
                }
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onToggle = onToggle
        coordinator.state.update(enabled: enabled, status: status)
    }
}

@MainActor
final class NostranslationDeviceAlerts: ObservableObject {
    static let shared = NostranslationDeviceAlerts()
    @Published private(set) var deviceToken: String?
    @Published private(set) var alertAccount: String?
    @Published private(set) var status: String?
    private let identity = NostrIdentityManager.shared
    private let store = NostrKeyStore()
    private let defaults = UserDefaults.standard
    private let api = TrustrootsAPI()
    private var syncTask: Task<Void, Never>?
    private var currentServer: String?
    var enabled: Bool {
        guard let account = identity.accountScope?.storageAccount else { return false }
        return defaults.bool(forKey: account + ":translation-alerts")
    }

    func setEnabled(_ enable: Bool, server: String) async {
        guard let account = identity.accountScope?.storageAccount else { return }
        let revision = identity.revision
        if enable {
            do {
                guard try await api.translationAlertsAvailable(serverURLString: server), identity.isCurrent(revision) else {
                    status = "Review alerts are unavailable on this server."
                    return
                }
                guard try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) else {
                    status = "Review alerts are disabled in Settings."
                    return
                }
            } catch {
                status = "Review alerts could not be enabled."
                return
            }
            guard identity.isCurrent(revision) else { return }
        }
        defaults.set(enable, forKey: account + ":translation-alerts")
        if enable { defaults.set(account, forKey: "nostranslation.notification-account") }
        else { defaults.removeObject(forKey: "nostranslation.notification-account") }
        status = nil
        reconcile(server: server)
    }

    func registerDeviceToken(_ data: Data) {
        deviceToken = data.map { String(format: "%02x", $0) }.joined()
        if let currentServer { reconcile(server: currentServer) }
    }

    func registrationFailed() { status = "Review alerts could not be enabled." }

    func captureAlert() {
        alertAccount = defaults.string(forKey: "nostranslation.notification-account")
    }

    func clearAlert() { alertAccount = nil }

    func retryPendingOptOut(server: String) {
        guard !enabled, syncTask == nil, let account = identity.accountScope?.storageAccount,
              let pending = defaults.stringArray(forKey: account + ":translation-alert-transports"),
              !pending.isEmpty else { return }
        reconcile(server: server)
    }

    func reconcile(server: String) {
        currentServer = server
        syncTask?.cancel()
        syncTask = nil
        guard let account = identity.accountScope?.storageAccount else {
            UIApplication.shared.unregisterForRemoteNotifications()
            deviceToken = nil
            return
        }
        if enabled { defaults.set(account, forKey: "nostranslation.notification-account") }
        let revision = identity.revision
        if enabled && deviceToken == nil {
            UIApplication.shared.registerForRemoteNotifications()
            return
        }
        let token = enabled ? deviceToken : nil
        if !enabled {
            UIApplication.shared.unregisterForRemoteNotifications()
            deviceToken = nil
        }
        syncTask = Task {
            defer { if !Task.isCancelled { syncTask = nil } }
            do {
                try await sync(server: server, account: account, revision: revision, token: token)
                try ensureCurrent(revision)
                status = token == nil ? nil : "Review alerts are enabled."
            } catch is CancellationError {
                return
            } catch {
                if identity.isCurrent(revision) {
                    status = token == nil
                        ? "Review alerts are off on this device. Server removal will retry when you return."
                        : "Review alerts could not be updated."
                }
            }
        }
    }

    private func sync(server: String, account: String, revision: Int64, token: String?) async throws {
        let priorKey = account + ":translation-alert-transports"
        let previous = Set(defaults.stringArray(forKey: priorKey) ?? [])
        var active = Set<String>()
        if let token,
           let data = try store.read(account: NostrIdentityManager.pairingAccount(account)) {
            let clients = try JSONDecoder().decode([NostranslationSigner.Client].self, from: Data(data.utf8))
            for client in clients {
                try ensureCurrent(revision)
                guard identity.publicKey == client.signingKey else { continue }
                let transport = try NostrCrypto.publicKey(secret: client.transportSecret)
                let registration: [String: Any] = [
                    "author": client.peer, "transport": transport,
                    "destination": ["platform": "ios", "token": token]
                ]
                let fields = [client.peer, transport, "ios", token]
                let binding = fields.map { "\($0.utf8.count):\($0)" }.joined()
                let digest = SHA256.hash(data: Data(binding.utf8)).map { String(format: "%02x", $0) }.joined()
                try await api.registerTranslationAlert(serverURLString: server, registration: registration) { event in
                    try self.ensureCurrent(revision)
                    return try Self.signChallenge(event, server: server, digest: digest, secret: client.transportSecret)
                }
                active.insert(transport)
                defaults.set(Array(previous.union(active)), forKey: priorKey)
            }
        }
        for removed in previous.subtracting(active) {
            try ensureCurrent(revision)
            try await api.unregisterTranslationAlert(serverURLString: server, transport: removed)
        }
        try ensureCurrent(revision)
        defaults.set(Array(active), forKey: priorKey)
    }

    private func ensureCurrent(_ revision: Int64) throws {
        try Task.checkCancellation()
        guard identity.isCurrent(revision) else { throw NostrIdentityError.inactiveSession }
    }

    private static func signChallenge(_ event: [String: Any], server: String, digest: String, secret: String) throws -> [String: Any] {
        let now = Int(Date().timeIntervalSince1970)
        guard event["kind"] as? Int == 27235,
              let created = event["created_at"] as? Int, (now - 120...now + 30).contains(created),
              event["content"] as? String == "", let tags = event["tags"] as? [[String]], tags.count == 4,
              let base = TrustrootsAPIConfiguration(baseURLString: server)?.baseURL else { throw NostrIdentityError.invalidKey }
        var values: [String: String] = [:]
        for tag in tags {
            guard tag.count == 2, values[tag[0]] == nil else { throw NostrIdentityError.invalidKey }
            values[tag[0]] = tag[1]
        }
        guard values["u"] == base.appendingPathComponent("api/mobile/v0/nostranslation/alerts").absoluteString,
              values["method"] == "PUT", values["payload"] == digest,
              let nonce = values["challenge"], nonce.wholeMatch(of: #/[a-f0-9]{64}/#) != nil else {
            throw NostrIdentityError.invalidKey
        }
        return try NIP07Bridge.sign(event: event, secret: secret)
    }
}

@MainActor
final class NostranslationNotificationDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NostranslationDeviceAlerts.shared.registerDeviceToken(deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NostranslationDeviceAlerts.shared.registrationFailed()
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        if response.notification.request.content.userInfo["type"] as? String == "nostranslation-review" {
            NostranslationDeviceAlerts.shared.captureAlert()
        }
    }
}

private struct NostranslationQRScanner: UIViewControllerRepresentable {
    let onScan: (String) -> Void
    let onUnavailable: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false
        )
        scanner.delegate = context.coordinator
        Task { @MainActor in
            do { try scanner.startScanning() }
            catch { onUnavailable() }
        }
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {}

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void

        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ scanner: DataScannerViewController, didTapOn item: RecognizedItem) {
            guard case let .barcode(barcode) = item, let value = barcode.payloadStringValue else { return }
            scanner.stopScanning()
            onScan(value)
        }
    }
}
