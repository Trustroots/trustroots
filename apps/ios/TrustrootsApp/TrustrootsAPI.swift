import Foundation
import MapKit
import Security
import SwiftUI

struct TrustrootsAPIConfiguration: Equatable {
    static let localDefaultURLString = "http://127.0.0.1:13001"
    static let catTestURLString = "https://pr2777.test.trustroots.org"
    static let productionURLString = "https://www.trustroots.org"

    static var buildDefaultURLString: String {
#if DEBUG
#if targetEnvironment(simulator)
        localDefaultURLString
#else
        catTestURLString
#endif
#else
        productionURLString
#endif
    }

    let baseURL: URL

    private static var permitsInsecureLoopback: Bool {
#if DEBUG && targetEnvironment(simulator)
        true
#else
        false
#endif
    }

    private static func isLoopback(host: String) -> Bool {
        ["localhost", "127.0.0.1", "::1"].contains(host.lowercased())
    }

    init?(baseURLString: String) {
        let trimmed = baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed),
              let scheme = url.scheme?.lowercased(),
              let host = url.host,
              url.user == nil,
              url.password == nil,
              url.query == nil,
              url.fragment == nil,
              url.path.isEmpty || url.path == "/",
              scheme == "https" || (
                scheme == "http"
                    && Self.permitsInsecureLoopback
                    && Self.isLoopback(host: host)
              ) else {
            return nil
        }
        self.baseURL = url
    }

    var normalizedURLString: String {
        baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}

enum TrustrootsBuildInfo {
    static var date: Date {
        let executablePath = Bundle.main.executableURL?.path ?? Bundle.main.bundlePath
        return (try? FileManager.default.attributesOfItem(atPath: executablePath)[.modificationDate] as? Date)
            ?? .now
    }

    static func formatted(_ date: Date = date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.string(from: date)
    }
}

struct SignedInMember: Codable, Equatable {
    let username: String
    let displayName: String
    let isPublic: Bool
    let email: String?
    let newsletter: Bool?

    enum CodingKeys: String, CodingKey {
        case username
        case displayName
        case isPublic = "public"
        case email
        case newsletter
    }

    init(
        username: String,
        displayName: String,
        isPublic: Bool,
        email: String? = nil,
        newsletter: Bool? = nil
    ) {
        self.username = username
        self.displayName = displayName
        self.isPublic = isPublic
        self.email = email
        self.newsletter = newsletter
    }
}

struct MobileAPIStatus: Decodable, Equatable {
    let contractVersion: String
    let buildVersion: String
    let startedAt: Date
    let revision: String?
}

struct MobileCredentials: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
}

struct MobileSessionResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let accessTokenExpiresAt: Date
    let member: SignedInMember

    var credentials: MobileCredentials {
        MobileCredentials(accessToken: accessToken, refreshToken: refreshToken)
    }
}

protocol MobileCredentialStoring: AnyObject {
    func load() -> MobileCredentials?
    @discardableResult func save(_ credentials: MobileCredentials) -> Bool
    func delete()
}

final class MobileCredentialStore: MobileCredentialStoring {
    private let service: String
    private let account: String

    init(
        service: String = "org.trustroots.ios.mobile-session",
        account: String = "bearer-tokens"
    ) {
        self.service = service
        self.account = account
    }

    func load() -> MobileCredentials? {
        var query = lookup
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return try? JSONDecoder().decode(MobileCredentials.self, from: data)
    }

    @discardableResult
    func save(_ credentials: MobileCredentials) -> Bool {
        guard let data = try? JSONEncoder().encode(credentials) else { return false }
        if SecItemCopyMatching(lookup as CFDictionary, nil) == errSecSuccess {
            return SecItemUpdate(
                lookup as CFDictionary,
                [kSecValueData as String: data] as CFDictionary
            ) == errSecSuccess
        }
        var attributes = lookup
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
    }

    func delete() {
        SecItemDelete(lookup as CFDictionary)
    }

    private var lookup: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}

struct MapOffer: Decodable, Identifiable {
    struct Properties: Decodable {
        let id: String
        let type: String
        let status: String?
    }

    struct Geometry: Decodable {
        let coordinates: [Double]
    }

    let properties: Properties
    let geometry: Geometry

    var id: String { properties.id }
    var type: String { properties.type }
    var coordinate: CLLocationCoordinate2D? {
        guard geometry.coordinates.count == 2 else { return nil }
        let coordinate = CLLocationCoordinate2D(
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0]
        )
        return CLLocationCoordinate2DIsValid(coordinate) ? coordinate : nil
    }
}

struct OfferFeatureCollection: Decodable {
    let features: [MapOffer]
}

struct MiniMember: Decodable {
    let id: String?
    let username: String?
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case mongoID = "_id"
        case username
        case displayName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .mongoID)
            ?? container.decodeIfPresent(String.self, forKey: .id)
        username = try container.decodeIfPresent(String.self, forKey: .username)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
    }
}

struct MemberProfile: Decodable {
    let id: String?
    let displayName: String
    let username: String
    let tagline: String?
    let description: String?
    let locationLiving: String?
    let locationFrom: String?
    let languages: [String]?
    let created: Date?
    let avatarUploaded: Bool?
    let email: String?
    let emailTemporary: String?
    let newsletter: Bool?
    let member: [ProfileCircleMembership]?

    enum CodingKeys: String, CodingKey {
        case id
        case mongoID = "_id"
        case displayName
        case username
        case tagline
        case description
        case locationLiving
        case locationFrom
        case languages
        case created
        case avatarUploaded
        case email
        case emailTemporary
        case newsletter
        case member
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .mongoID)
            ?? container.decodeIfPresent(String.self, forKey: .id)
        username = try container.decode(String.self, forKey: .username)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName) ?? username
        tagline = try container.decodeIfPresent(String.self, forKey: .tagline)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        locationLiving = try container.decodeIfPresent(String.self, forKey: .locationLiving)
        locationFrom = try container.decodeIfPresent(String.self, forKey: .locationFrom)
        languages = try container.decodeIfPresent([String].self, forKey: .languages)
        created = try container.decodeIfPresent(Date.self, forKey: .created)
        avatarUploaded = try container.decodeIfPresent(Bool.self, forKey: .avatarUploaded)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        emailTemporary = try container.decodeIfPresent(String.self, forKey: .emailTemporary)
        newsletter = try container.decodeIfPresent(Bool.self, forKey: .newsletter)
        member = try container.decodeIfPresent([ProfileCircleMembership].self, forKey: .member)
    }
}

struct ProfileCircleMembership: Decodable {
    let tribe: ProfileCircle
}

struct ProfileCircle: Decodable, Identifiable {
    let id: String
    let label: String

    enum CodingKeys: String, CodingKey {
        case id
        case mongoID = "_id"
        case label
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .mongoID)
            ?? container.decode(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label) ?? "Circle"
    }
}

struct HostOffer: Decodable {
    let id: String
    let type: String
    let status: String?
    let description: String?
    let noOfferDescription: String?
    let maxGuests: Int?
    let user: MiniMember

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case type
        case status
        case description
        case noOfferDescription
        case maxGuests
        case user
    }
}

struct TrustrootsCircle: Decodable, Identifiable {
    let id: String
    let slug: String
    let label: String
    let count: Int
    let description: String?
    let image: Bool
    let color: String?

    enum CodingKeys: String, CodingKey {
        case id
        case mongoID = "_id"
        case slug
        case label
        case count
        case description
        case image
        case color
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .mongoID)
            ?? container.decode(String.self, forKey: .id)
        slug = try container.decode(String.self, forKey: .slug)
        label = try container.decode(String.self, forKey: .label)
        count = try container.decodeIfPresent(Int.self, forKey: .count) ?? 0
        description = try container.decodeIfPresent(String.self, forKey: .description)
        image = try container.decodeIfPresent(Bool.self, forKey: .image) ?? false
        color = try container.decodeIfPresent(String.self, forKey: .color)
    }
}

struct CircleMembership: Decodable {
    let tribe: TrustrootsCircle
}

struct TrustrootsContact: Decodable, Identifiable {
    let id: String
    let confirmed: Bool
    let user: MiniMember

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case confirmed
        case user
    }
}

struct MemberExperience: Decodable, Identifiable {
    struct Interactions: Decodable {
        let met: Bool?
        let guest: Bool?
        let host: Bool?
    }

    let id: String
    let created: Date?
    let feedbackPublic: String?
    let recommend: String?
    let interactions: Interactions?
    let userFrom: MiniMember
    let userTo: MiniMember
    let response: ExperienceResponse?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case created
        case feedbackPublic
        case recommend
        case interactions
        case userFrom
        case userTo
        case response
    }
}

struct ExperienceResponse: Decodable {
    let feedbackPublic: String?
    let recommend: String?
}

struct ConversationExperience: Decodable, Identifiable {
    let id: String
    let userFromID: String?
    let feedbackPublic: String?
    let recommend: String?
    let response: ExperienceResponse?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case userFrom
        case feedbackPublic
        case recommend
        case response
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        if let id = try? container.decode(String.self, forKey: .userFrom) {
            userFromID = id
        } else {
            let member = try? container.decode(MiniMember.self, forKey: .userFrom)
            userFromID = member?.id
        }
        feedbackPublic = try container.decodeIfPresent(String.self, forKey: .feedbackPublic)
        recommend = try container.decodeIfPresent(String.self, forKey: .recommend)
        response = try container.decodeIfPresent(ExperienceResponse.self, forKey: .response)
    }
}

struct MessageExcerpt: Decodable {
    let excerpt: String?
}

struct MessageThread: Decodable, Identifiable {
    let id: String
    let message: MessageExcerpt
    let read: Bool
    let updated: Date
    let userFrom: MiniMember
    let userTo: MiniMember

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case message
        case read
        case updated
        case userFrom
        case userTo
    }

    func otherMember(excluding username: String?) -> MiniMember {
        guard let username else { return userTo }
        return userFrom.username == username ? userTo : userFrom
    }
}

struct DirectMessage: Decodable, Identifiable {
    let id: String
    let content: String
    let userFrom: MiniMember

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case content
        case userFrom
    }

    func isFrom(username: String?) -> Bool {
        userFrom.username == username
    }
}

enum TrustrootsAPIError: LocalizedError, Equatable {
    case invalidServerURL
    case invalidResponse
    case authenticationRequired
    case requestFailed(String)
    case serverMessage(String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL:
            return "Enter a valid API server address."
        case .invalidResponse:
            return "Trustroots returned an unexpected response."
        case .authenticationRequired:
            return "Your session is no longer valid. Please sign in again."
        case .requestFailed(let description):
            return "Could not reach Trustroots: \(description)"
        case .serverMessage(let message):
            return message
        }
    }
}

struct APIServerDiagnostic: Equatable {
    enum State: Equatable {
        case checking
        case available
        case authenticationRejected
        case endpointMissing
        case rateLimited
        case serverError
        case networkError
        case invalidConfiguration
        case unexpectedResponse
    }

    let state: State
    let title: String
    let detail: String
    let statusCode: Int?

    static let checking = APIServerDiagnostic(
        state: .checking,
        title: "Checking mobile API…",
        detail: "Testing the authenticated mobile endpoint.",
        statusCode: nil
    )

    var isUsable: Bool { state == .available }
    var serverResponded: Bool {
        guard let statusCode else { return false }
        return statusCode < 500
    }

    var systemImage: String {
        switch state {
        case .checking: return "arrow.triangle.2.circlepath"
        case .available: return "checkmark.circle.fill"
        case .authenticationRejected: return "person.crop.circle.badge.exclamationmark"
        case .endpointMissing: return "questionmark.folder"
        case .rateLimited: return "hourglass.circle"
        case .serverError: return "exclamationmark.icloud.fill"
        case .networkError: return "wifi.slash"
        case .invalidConfiguration: return "link.badge.plus"
        case .unexpectedResponse: return "exclamationmark.triangle.fill"
        }
    }

    var colour: Color {
        switch state {
        case .available: return TrustrootsPalette.darkGreen
        case .checking: return .secondary
        case .authenticationRejected, .endpointMissing, .rateLimited, .unexpectedResponse: return .orange
        case .serverError, .networkError, .invalidConfiguration: return .red
        }
    }

    static func response(statusCode: Int, message: String? = nil) -> APIServerDiagnostic {
        let suffix = "HTTP \(statusCode)"
        switch statusCode {
        case 200..<300:
            return .init(state: .available, title: "Mobile API available", detail: suffix, statusCode: statusCode)
        case 401, 403:
            let reason = message.map { "Server message: \($0). " } ?? ""
            return .init(
                state: .authenticationRejected,
                title: "Session rejected",
                detail: "\(reason)The server is reachable, but it did not accept this app session (\(suffix)). Sign in again if this persists.",
                statusCode: statusCode
            )
        case 404:
            return .init(
                state: .endpointMissing,
                title: "Mobile API not found",
                detail: "The server is reachable, but /api/mobile/v0/me is unavailable (\(suffix)).",
                statusCode: statusCode
            )
        case 429:
            return .init(
                state: .rateLimited,
                title: "Too many requests",
                detail: message ?? "The API asked the app to slow down (\(suffix)).",
                statusCode: statusCode
            )
        case 500..<600:
            return .init(
                state: .serverError,
                title: "API server error",
                detail: message ?? "The server returned an error (\(suffix)).",
                statusCode: statusCode
            )
        default:
            return .init(
                state: .unexpectedResponse,
                title: "Unexpected API response",
                detail: message ?? suffix,
                statusCode: statusCode
            )
        }
    }

    static func networkFailure(_ error: Error) -> APIServerDiagnostic {
        let urlError = error as? URLError
        let title: String
        switch urlError?.code {
        case .notConnectedToInternet: title = "No internet connection"
        case .timedOut: title = "API request timed out"
        case .cannotFindHost, .dnsLookupFailed: title = "API hostname not found"
        case .cannotConnectToHost: title = "Could not connect to API"
        case .networkConnectionLost: title = "Connection to API was lost"
        case .secureConnectionFailed, .serverCertificateUntrusted: title = "Secure connection failed"
        default: title = "API network error"
        }
        return .init(
            state: .networkError,
            title: title,
            detail: error.localizedDescription,
            statusCode: nil
        )
    }

    static let invalidConfiguration = APIServerDiagnostic(
        state: .invalidConfiguration,
        title: "Invalid API address",
        detail: "The configured API server URL is not allowed.",
        statusCode: nil
    )

    static let unexpectedResponse = APIServerDiagnostic(
        state: .unexpectedResponse,
        title: "Unexpected API response",
        detail: "The server did not return an HTTP response.",
        statusCode: nil
    )
}

final class TrustrootsAPI {
    private let session: URLSession
    private let credentialStore: MobileCredentialStoring
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let standard = ISO8601DateFormatter()
            standard.formatOptions = [.withInternetDateTime]
            if let date = fractional.date(from: value) ?? standard.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO 8601 date")
        }
        return decoder
    }()
    private let encoder = JSONEncoder()

    init(
        session: URLSession = .trustroots,
        credentialStore: MobileCredentialStoring = MobileCredentialStore()
    ) {
        self.session = session
        self.credentialStore = credentialStore
    }

    func signIn(
        serverURLString: String,
        usernameOrEmail: String,
        password: String
    ) async throws -> MobileSessionResponse {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }

        let endpoint = configuration.baseURL.appendingPathComponent("api/mobile/v0/auth/signin")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode([
            "username": usernameOrEmail,
            "password": password,
        ])

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode, isSignIn: true)
            }
            do {
                return try decoder.decode(MobileSessionResponse.self, from: data)
            } catch {
                throw TrustrootsAPIError.invalidResponse
            }
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func status(serverURLString: String) async throws -> MobileAPIStatus {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        let endpoint = configuration.baseURL.appendingPathComponent("api/mobile/v0/status")
        var request = URLRequest(url: endpoint)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode, isSignIn: true)
            }
            return try decoder.decode(MobileAPIStatus.self, from: data)
        } catch let error as TrustrootsAPIError {
            throw error
        } catch is DecodingError {
            throw TrustrootsAPIError.invalidResponse
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func refresh(serverURLString: String, refreshToken: String) async throws -> MobileSessionResponse {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        let endpoint = configuration.baseURL.appendingPathComponent("api/mobile/v0/auth/refresh")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(["refreshToken": refreshToken])

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
            return try decoder.decode(MobileSessionResponse.self, from: data)
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func currentMember(serverURLString: String) async throws -> SignedInMember {
        struct CurrentMemberResponse: Decodable { let member: SignedInMember }
        let response: CurrentMemberResponse = try await get(
            serverURLString: serverURLString,
            path: "api/mobile/v0/me"
        )
        return response.member
    }

    func signOut(serverURLString: String) async {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            return
        }
        let endpoint = configuration.baseURL.appendingPathComponent("api/mobile/v0/auth/signout")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        authorise(&request)
        _ = try? await session.data(for: request)
        credentialStore.delete()
    }

    func isServerReachable(serverURLString: String) async -> Bool {
        await diagnoseServer(serverURLString: serverURLString).serverResponded
    }

    func diagnoseServer(serverURLString: String) async -> APIServerDiagnostic {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            return .invalidConfiguration
        }
        let endpoint = configuration.baseURL.appendingPathComponent("api/mobile/v0/me")
        var request = URLRequest(url: endpoint)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        authorise(&request)

        do {
            let (data, rawResponse) = try await session.data(for: request)
            guard let response = rawResponse as? HTTPURLResponse else {
                return .unexpectedResponse
            }
            struct ErrorResponse: Decodable { let message: String? }
            let message = (try? decoder.decode(ErrorResponse.self, from: data))?.message
            return .response(statusCode: response.statusCode, message: message)
        } catch {
            return .networkFailure(error)
        }
    }

    func searchOffers(
        serverURLString: String,
        in region: MKCoordinateRegion,
        types: [String] = ["host"],
        tribeIDs: [String] = []
    ) async throws -> [MapOffer] {
        let latitudeDelta = region.span.latitudeDelta / 2
        let longitudeDelta = region.span.longitudeDelta / 2
        let response: OfferFeatureCollection = try await get(
            serverURLString: serverURLString,
            path: "api/mobile/v0/offers",
            queryItems: [
                URLQueryItem(name: "southWestLat", value: String(region.center.latitude - latitudeDelta)),
                URLQueryItem(name: "southWestLng", value: String(region.center.longitude - longitudeDelta)),
                URLQueryItem(name: "northEastLat", value: String(region.center.latitude + latitudeDelta)),
                URLQueryItem(name: "northEastLng", value: String(region.center.longitude + longitudeDelta)),
                URLQueryItem(
                    name: "filters",
                    value: "{\"types\":\(types.jsonArray),\"tribes\":\(tribeIDs.jsonArray)}"
                ),
            ]
        )
        return response.features.filter { $0.coordinate != nil }
    }

    func offer(serverURLString: String, offerID: String) async throws -> HostOffer {
        try await get(serverURLString: serverURLString, path: "api/mobile/v0/offers/\(offerID)")
    }

    func profile(serverURLString: String, username: String) async throws -> MemberProfile {
        struct ProfileResponse: Decodable { let profile: MemberProfile }
        let response: ProfileResponse = try await get(
            serverURLString: serverURLString,
            path: "api/mobile/v0/profiles/\(username)"
        )
        return response.profile
    }

    func circles(serverURLString: String) async throws -> [TrustrootsCircle] {
        try await get(
            serverURLString: serverURLString,
            path: "api/mobile/v0/circles",
            queryItems: [URLQueryItem(name: "limit", value: "150")]
        )
    }

    func circleMemberships(serverURLString: String) async throws -> [CircleMembership] {
        try await get(serverURLString: serverURLString, path: "api/mobile/v0/memberships")
    }

    func contacts(serverURLString: String, userID: String) async throws -> [TrustrootsContact] {
        try await get(serverURLString: serverURLString, path: "api/mobile/v0/contacts/\(userID)")
    }

    func experiences(serverURLString: String, userID: String) async throws -> [MemberExperience] {
        try await get(
            serverURLString: serverURLString,
            path: "api/mobile/v0/experiences",
            queryItems: [URLQueryItem(name: "userTo", value: userID)]
        )
    }

    func conversationExperience(
        serverURLString: String,
        memberID: String
    ) async throws -> ConversationExperience? {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        let components = URLComponents(
            url: configuration.baseURL.appendingPathComponent("api/mobile/v0/experiences/with/\(memberID)"),
            resolvingAgainstBaseURL: false
        )
        guard let url = components?.url else { throw TrustrootsAPIError.invalidResponse }
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        authorise(&request)

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            if httpResponse.statusCode == 404 { return nil }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
            return try decoder.decode(ConversationExperience.self, from: data)
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func createExperience(
        serverURLString: String,
        memberID: String,
        met: Bool,
        hosted: Bool,
        wasGuest: Bool,
        recommendation: String,
        feedback: String
    ) async throws -> ConversationExperience {
        struct ExperienceInteractions: Encodable {
            let met: Bool
            let guest: Bool
            let host: Bool
        }
        struct ExperienceRequest: Encodable {
            let userTo: String
            let interactions: ExperienceInteractions
            let recommend: String
            let feedbackPublic: String
        }

        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        var request = URLRequest(url: configuration.baseURL.appendingPathComponent("api/mobile/v0/experiences"))
        authorise(&request)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(ExperienceRequest(
            userTo: memberID,
            interactions: ExperienceInteractions(met: met, guest: wasGuest, host: hosted),
            recommend: recommendation,
            feedbackPublic: feedback
        ))

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
            return try decoder.decode(ConversationExperience.self, from: data)
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func sendSupportMessage(serverURLString: String, message: String) async throws {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        var request = URLRequest(url: configuration.baseURL.appendingPathComponent("api/mobile/v0/support"))
        authorise(&request)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(["message": message])

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func updateAccount(
        serverURLString: String,
        email: String,
        newsletter: Bool
    ) async throws -> MemberProfile {
        struct AccountUpdate: Encodable {
            let email: String
            let newsletter: Bool
        }

        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        var request = URLRequest(url: configuration.baseURL.appendingPathComponent("api/mobile/v0/account"))
        authorise(&request)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(AccountUpdate(email: email, newsletter: newsletter))

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
            return try decoder.decode(MemberProfile.self, from: data)
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func updateProfile(
        serverURLString: String,
        displayName: String,
        tagline: String,
        description: String,
        locationLiving: String,
        locationFrom: String,
        languages: [String]
    ) async throws -> MemberProfile {
        struct ProfileUpdate: Encodable {
            let displayName: String
            let tagline: String
            let description: String
            let locationLiving: String
            let locationFrom: String
            let languages: [String]
        }

        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        var request = URLRequest(url: configuration.baseURL.appendingPathComponent("api/mobile/v0/profile"))
        authorise(&request)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(
            ProfileUpdate(
                displayName: displayName,
                tagline: tagline,
                description: description,
                locationLiving: locationLiving,
                locationFrom: locationFrom,
                languages: languages
            )
        )

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
            return try decoder.decode(MemberProfile.self, from: data)
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func changePassword(
        serverURLString: String,
        currentPassword: String,
        newPassword: String,
        verifyPassword: String
    ) async throws {
        struct PasswordChange: Encodable {
            let currentPassword: String
            let newPassword: String
            let verifyPassword: String
        }

        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        var request = URLRequest(url: configuration.baseURL.appendingPathComponent("api/mobile/v0/account/password"))
        authorise(&request)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(
            PasswordChange(
                currentPassword: currentPassword,
                newPassword: newPassword,
                verifyPassword: verifyPassword
            )
        )

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func setCircleMembership(
        serverURLString: String,
        circleID: String,
        isMember: Bool
    ) async throws {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        var request = URLRequest(
            url: configuration.baseURL.appendingPathComponent("api/mobile/v0/memberships/\(circleID)")
        )
        authorise(&request)
        request.httpMethod = isMember ? "DELETE" : "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    func inbox(
        serverURLString: String,
        page: Int = 1,
        limit: Int = 50
    ) async throws -> [MessageThread] {
        try await get(
            serverURLString: serverURLString,
            path: "api/mobile/v0/messages",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )
    }

    func conversation(serverURLString: String, memberID: String) async throws -> [DirectMessage] {
        try await get(
            serverURLString: serverURLString,
            path: "api/mobile/v0/messages/\(memberID)",
            queryItems: [URLQueryItem(name: "limit", value: "30")]
        )
    }

    func sendMessage(
        serverURLString: String,
        memberID: String,
        content: String
    ) async throws -> DirectMessage {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }
        let endpoint = configuration.baseURL.appendingPathComponent("api/mobile/v0/messages")
        var request = URLRequest(url: endpoint)
        authorise(&request)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode([
            "userTo": memberID,
            "content": content,
        ])

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
            do {
                return try decoder.decode(DirectMessage.self, from: data)
            } catch {
                throw TrustrootsAPIError.invalidResponse
            }
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    private func get<Response: Decodable>(
        serverURLString: String,
        path: String,
        queryItems: [URLQueryItem] = [],
        didRetryAfterRefresh: Bool = false
    ) async throws -> Response {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            throw TrustrootsAPIError.invalidServerURL
        }

        var components = URLComponents(
            url: configuration.baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = queryItems
        guard let url = components?.url else {
            throw TrustrootsAPIError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        authorise(&request)

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TrustrootsAPIError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                if isMobileBearerPath(path),
                   !didRetryAfterRefresh,
                   httpResponse.statusCode == 401 {
                    do {
                        try await refreshCredentialsForRetry(serverURLString: serverURLString)
                        return try await get(
                            serverURLString: serverURLString,
                            path: path,
                            queryItems: queryItems,
                            didRetryAfterRefresh: true
                        )
                    } catch TrustrootsAPIError.requestFailed {
                        throw TrustrootsAPIError.requestFailed("Could not refresh your session.")
                    } catch {
                        NotificationCenter.default.post(
                            name: .trustrootsAuthenticationRequired,
                            object: nil
                        )
                        throw TrustrootsAPIError.authenticationRequired
                    }
                }
                if isMobileBearerPath(path),
                   httpResponse.statusCode == 401 {
                    NotificationCenter.default.post(
                        name: .trustrootsAuthenticationRequired,
                        object: nil
                    )
                    throw TrustrootsAPIError.authenticationRequired
                }
                throw decodedError(from: data, statusCode: httpResponse.statusCode)
            }
            do {
                let decoded = try decoder.decode(Response.self, from: data)
                try? await OfflineResponseCache.shared.save(data, for: url)
                await OfflineAvailability.shared.showLiveData()
                return decoded
            } catch {
                throw TrustrootsAPIError.invalidResponse
            }
        } catch let error as TrustrootsAPIError {
            throw error
        } catch {
            if let cached = await OfflineResponseCache.shared.response(for: url),
               let decoded = try? decoder.decode(Response.self, from: cached.data) {
                await OfflineAvailability.shared.showSavedData(from: cached.savedAt)
                return decoded
            }
            throw TrustrootsAPIError.requestFailed(error.localizedDescription)
        }
    }

    private func decodedError(
        from data: Data,
        statusCode: Int,
        isSignIn: Bool = false
    ) -> TrustrootsAPIError {
        if isSignIn && statusCode == 404 {
            return .serverMessage(
                "This API server has not been updated for the mobile app yet. It is missing /api/mobile/v0."
            )
        }
        if !isSignIn && (statusCode == 401 || statusCode == 403) {
            return .authenticationRequired
        }
        struct ErrorResponse: Decodable {
            let message: String?
        }
        let message = (try? decoder.decode(ErrorResponse.self, from: data))?.message
        return .serverMessage(message ?? "Sign-in was not accepted.")
    }

    private func authorise(_ request: inout URLRequest) {
        guard let accessToken = credentialStore.load()?.accessToken else { return }
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    }

    private func isMobileBearerPath(_ path: String) -> Bool {
        path.hasPrefix("api/mobile/v0/")
    }

    private func refreshCredentialsForRetry(serverURLString: String) async throws {
        guard let rejectedCredentials = credentialStore.load() else {
            throw TrustrootsAPIError.authenticationRequired
        }
        _ = try await MobileRefreshCoordinator.shared.refresh(
            serverURLString: serverURLString
        ) { [self] in
            guard let currentCredentials = credentialStore.load() else {
                throw TrustrootsAPIError.authenticationRequired
            }
            if currentCredentials.refreshToken != rejectedCredentials.refreshToken {
                return currentCredentials
            }

            let mobileSession = try await refresh(
                serverURLString: serverURLString,
                refreshToken: rejectedCredentials.refreshToken
            )
            guard credentialStore.load()?.refreshToken == rejectedCredentials.refreshToken else {
                guard let currentCredentials = credentialStore.load() else {
                    throw TrustrootsAPIError.authenticationRequired
                }
                return currentCredentials
            }
            guard credentialStore.save(mobileSession.credentials) else {
                throw TrustrootsAPIError.serverMessage("Secure credential storage is unavailable.")
            }
            return mobileSession.credentials
        }
    }
}

actor MobileRefreshCoordinator {
    static let shared = MobileRefreshCoordinator()

    private var refreshTasks: [String: Task<MobileCredentials, Error>] = [:]

    func refresh(
        serverURLString: String,
        operation: @escaping @Sendable () async throws -> MobileCredentials
    ) async throws -> MobileCredentials {
        if let existing = refreshTasks[serverURLString] {
            return try await existing.value
        }

        let task = Task { try await operation() }
        refreshTasks[serverURLString] = task
        defer { refreshTasks[serverURLString] = nil }
        return try await task.value
    }
}

extension Notification.Name {
    static let trustrootsAuthenticationRequired = Notification.Name(
        "org.trustroots.ios.authentication-required"
    )
}

private extension Array where Element == String {
    var jsonArray: String {
        let data = (try? JSONEncoder().encode(self)) ?? Data("[]".utf8)
        return String(decoding: data, as: UTF8.self)
    }
}

extension URLSession {
    static let trustroots: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpCookieStorage = nil
        return URLSession(configuration: configuration)
    }()
}
