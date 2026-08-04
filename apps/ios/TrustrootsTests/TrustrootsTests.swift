import MapKit
import XCTest
@testable import Trustroots

final class TrustrootsTests: XCTestCase {
    func testAuthenticationFailureHasClearSignInAgainMessage() {
        XCTAssertEqual(
            TrustrootsAPIError.authenticationRequired.errorDescription,
            "Your session is no longer valid. Please sign in again."
        )
    }

    func testAPIServerDiagnosticDistinguishesUsefulHTTPFailures() {
        let available = APIServerDiagnostic.response(statusCode: 200)
        XCTAssertEqual(available.state, .available)
        XCTAssertTrue(available.isUsable)
        XCTAssertTrue(available.serverResponded)

        let rejected = APIServerDiagnostic.response(statusCode: 403, message: "Forbidden")
        XCTAssertEqual(rejected.state, .authenticationRejected)
        XCTAssertTrue(rejected.detail.contains("Forbidden"))
        XCTAssertTrue(rejected.detail.localizedCaseInsensitiveContains("sign in again"))

        XCTAssertEqual(APIServerDiagnostic.response(statusCode: 404).state, .endpointMissing)
        XCTAssertEqual(APIServerDiagnostic.response(statusCode: 429).state, .rateLimited)
        XCTAssertEqual(APIServerDiagnostic.response(statusCode: 503).state, .serverError)
        XCTAssertFalse(APIServerDiagnostic.response(statusCode: 503).serverResponded)
        XCTAssertEqual(APIServerDiagnostic.response(statusCode: 302).state, .unexpectedResponse)
    }

    func testAPIServerDiagnosticDistinguishesNetworkFailures() {
        XCTAssertEqual(
            APIServerDiagnostic.networkFailure(URLError(.timedOut)).title,
            "API request timed out"
        )
        XCTAssertEqual(
            APIServerDiagnostic.networkFailure(URLError(.cannotFindHost)).title,
            "API hostname not found"
        )
        XCTAssertEqual(
            APIServerDiagnostic.networkFailure(URLError(.secureConnectionFailed)).title,
            "Secure connection failed"
        )
        XCTAssertFalse(APIServerDiagnostic.invalidConfiguration.serverResponded)
        XCTAssertEqual(APIServerDiagnostic.unexpectedResponse.state, .unexpectedResponse)
    }

    func testBuildDateUsesStableYearMonthDayAndTimeFormat() {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let formatted = TrustrootsBuildInfo.formatted(date)

        XCTAssertTrue(formatted.range(of: #"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$"#, options: .regularExpression) != nil)
    }

    func testBrowserRoutesUseTheProductionTrustrootsOrigin() {
        XCTAssertEqual(
            TrustrootsBrowserRoute.join.url.absoluteString,
            "https://www.trustroots.org/signup"
        )
        XCTAssertEqual(
            TrustrootsBrowserRoute.confirmation.url.absoluteString,
            "https://www.trustroots.org/confirm-email"
        )
        XCTAssertEqual(
            TrustrootsBrowserRoute.passwordRecovery.url.absoluteString,
            "https://www.trustroots.org/password/forgot"
        )
    }

    func testBrowserRouteIdentifiersAreDistinct() {
        XCTAssertNotEqual(
            TrustrootsBrowserRoute.confirmation.id,
            TrustrootsBrowserRoute.passwordRecovery.id
        )
    }

    func testBrowserHomeRouteDoesNotBehaveLikeAChildPage() {
        XCTAssertTrue(TrustrootsBrowserRoute.website(path: "/", title: "Trustroots").isHome)
        XCTAssertTrue(
            TrustrootsBrowserRoute.website(
                path: "https://www.trustroots.org/",
                title: "Trustroots"
            ).isHome
        )
        XCTAssertFalse(
            TrustrootsBrowserRoute.website(path: "/about", title: "About Trustroots").isHome
        )
        XCTAssertFalse(TrustrootsBrowserRoute.join.isHome)
    }

    func testBrowserKeepsTrustrootsSubdomainsInApp() throws {
        XCTAssertTrue(
            TrustrootsWebView.Coordinator.isTrustrootsURL(
                try XCTUnwrap(URL(string: "https://www.trustroots.org/password/forgot"))
            )
        )
        XCTAssertTrue(
            TrustrootsWebView.Coordinator.isTrustrootsURL(
                try XCTUnwrap(URL(string: "https://community.trustroots.org/"))
            )
        )
        XCTAssertTrue(
            TrustrootsWebView.Coordinator.isTrustrootsURL(
                try XCTUnwrap(URL(string: "https://wiki.hitchwiki.org/"))
            )
        )
    }

    func testBrowserDoesNotTreatLookalikeDomainAsTrustroots() throws {
        XCTAssertFalse(
            TrustrootsWebView.Coordinator.isTrustrootsURL(
                try XCTUnwrap(URL(string: "https://trustroots.org.example.com/"))
            )
        )
    }

    func testAppDefaultsToTheProductionAPI() {
        let configuration = TrustrootsAPIConfiguration(
            baseURLString: TrustrootsAPIConfiguration.buildDefaultURLString
        )

        XCTAssertEqual(configuration?.baseURL.absoluteString, "https://www.trustroots.org")
    }

    func testAPIConfigurationRejectsMissingOrUnsupportedURLs() {
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "localhost:3001"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "ftp://127.0.0.1:3001"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: ""))
    }

    func testAPIConfigurationRejectsRemoteClearTextAndCredentials() {
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "http://api.example.org"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "http://192.0.2.1:3001"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "https://member:secret@example.org"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "https://api.example.org/mobile"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "https://api.example.org?token=secret"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "https://api.example.org#fragment"))
        XCTAssertNotNil(TrustrootsAPIConfiguration(baseURLString: "https://api.example.org"))
    }

    func testAPIConfigurationRejectsClearTextLoopbackOrigins() {
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "http://localhost:13001"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "http://127.0.0.1:13001"))
        XCTAssertNil(TrustrootsAPIConfiguration(baseURLString: "http://[::1]:13001"))
    }

    func testSignedInMemberRoundTripsForSessionRestoration() throws {
        let member = SignedInMember(
            username: "traveller",
            displayName: "A Traveller",
            isPublic: true,
            email: "traveller@example.test",
            newsletter: true
        )

        let restoredMember = try JSONDecoder().decode(
            SignedInMember.self,
            from: JSONEncoder().encode(member)
        )

        XCTAssertEqual(restoredMember, member)
        XCTAssertEqual(restoredMember.email, "traveller@example.test")
        XCTAssertEqual(restoredMember.newsletter, true)
    }

    func testNativeURLSessionKeepsTheWebsiteSessionOutOfSharedCookieStorage() {
        XCTAssertFalse(URLSession.trustroots.configuration.httpShouldSetCookies)
        XCTAssertEqual(URLSession.trustroots.configuration.httpCookieAcceptPolicy, .never)
        XCTAssertNil(URLSession.trustroots.configuration.httpCookieStorage)
    }

    func testInboxAccumulatorDoesNotDuplicateThreadsWhenInboxReloads() throws {
        let payload = Data(
            #"[{"_id":"thread-1","message":{"excerpt":"Hello"},"read":true,"updated":"2026-07-29T12:00:00Z","userFrom":{"_id":"member-1","username":"first"},"userTo":{"_id":"member-2","username":"second"}}]"#.utf8
        )
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let page = try decoder.decode([MessageThread].self, from: payload)
        var accumulator = MessageThreadAccumulator()

        accumulator.append(page)
        accumulator.append(page)

        XCTAssertEqual(accumulator.threads.map(\.id), ["thread-1"])
    }

    func testMapOfferUsesGeoJSONLongitudeThenLatitudeCoordinates() {
        let offer = MapOffer(
            properties: .init(id: "offer-1", type: "host", status: "yes"),
            geometry: .init(coordinates: [-9.1393, 38.7223])
        )

        XCTAssertEqual(offer.coordinate?.latitude, 38.7223)
        XCTAssertEqual(offer.coordinate?.longitude, -9.1393)
    }

    func testOfferSearchDefaultsToMembersSeenWithinSixMonths() async throws {
        let credentialStore = InMemorySessionCredentialStore()
        XCTAssertTrue(credentialStore.save(
            SessionCredentials(cookieHeader: "connect.sid=signed-session", username: "traveller")
        ))

        var recordedRequest: URLRequest?
        APIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(#"{"features":[]}"#.utf8))
        }
        defer { APIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        _ = try await api.searchOffers(
            serverURLString: "https://api.example.test",
            in: MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 38.72, longitude: -9.14),
                span: MKCoordinateSpan(latitudeDelta: 1, longitudeDelta: 1)
            )
        )

        let filtersValue = URLComponents(
            url: try XCTUnwrap(recordedRequest?.url),
            resolvingAgainstBaseURL: false
        )?.queryItems?.first(where: { $0.name == "filters" })?.value
        let filtersData = try XCTUnwrap(filtersValue?.data(using: .utf8))
        let filters = try JSONSerialization.jsonObject(with: filtersData) as? [String: Any]
        let seen = filters?["seen"] as? [String: Any]

        XCTAssertEqual(recordedRequest?.url?.path, "/api/offers")
        XCTAssertEqual(seen?["months"] as? Int, 6)
    }

    func testAboutRouteUsesTheDedicatedWebsitePage() {
        XCTAssertEqual(
            TrustrootsBrowserRoute.website(path: "/about", title: "About Trustroots").url.path,
            "/about"
        )
    }

    func testNostrKeyCodecGeneratesAndAcceptsPrivateKeyHex() throws {
        let secret = NostrKeyCodec.generateSecret()

        XCTAssertTrue(NostrKeyCodec.isSecretHex(secret))
        XCTAssertEqual(try NostrKeyCodec.importSecret(secret), secret)
    }

    func testNostrPublicKeyCanBeShownAsNpub() throws {
        let publicKey = try NostrCrypto.publicKey(secret: NostrKeyCodec.generateSecret())
        let npub = try XCTUnwrap(NostrCrypto.npub(publicKey: publicKey))

        XCTAssertTrue(npub.hasPrefix("npub1"))
        XCTAssertNotEqual(npub, publicKey)
    }

    func testConversationExperienceIdentifiesWhoSharedIt() throws {
        let data = Data(#"{"_id":"experience-1","userFrom":"member-2","recommend":"yes","response":null}"#.utf8)
        let experience = try JSONDecoder().decode(ConversationExperience.self, from: data)

        XCTAssertEqual(experience.userFromID, "member-2")
        XCTAssertEqual(experience.recommend, "yes")
        XCTAssertNil(experience.response)
    }

    func testNIP07OnlyTrustsApprovedHTTPSOrigins() throws {
        XCTAssertEqual(
            NIP07Bridge.trustedOrigin(for: try XCTUnwrap(URL(string: "https://community.trustroots.org/notes"))),
            "https://community.trustroots.org"
        )
        XCTAssertNil(NIP07Bridge.trustedOrigin(for: try XCTUnwrap(URL(string: "http://www.trustroots.org"))))
        XCTAssertNil(NIP07Bridge.trustedOrigin(for: try XCTUnwrap(URL(string: "https://trustroots.org.example.com"))))
        XCTAssertEqual(
            NIP07Bridge.trustedOrigin(
                for: try XCTUnwrap(URL(string: "https://wiki.hitchwiki.org/places"))
            ),
            "https://wiki.hitchwiki.org"
        )
        XCTAssertNil(
            NIP07Bridge.trustedOrigin(
                for: try XCTUnwrap(URL(string: "https://hitchwiki.org.example.com"))
            )
        )
        XCTAssertTrue(NIP07Bridge.isAutomaticallyAllowed("https://www.trustroots.org"))
        XCTAssertTrue(NIP07Bridge.isAutomaticallyAllowed("https://wiki.hitchwiki.org"))
        XCTAssertFalse(NIP07Bridge.isAutomaticallyAllowed("http://wiki.hitchwiki.org"))
    }

    func testLanguagePickerIncludesHundredsOfRecognisedLanguagesIncludingGalician() {
        XCTAssertGreaterThan(TrustrootsLanguage.availableCodes.count, 100)
        XCTAssertTrue(TrustrootsLanguage.availableCodes.contains("glg"))
        XCTAssertNotEqual(TrustrootsLanguage.displayName(for: "glg"), "GLG")
    }

    func testOpenLocationCodeDecoderFindsGoogleplexSample() throws {
        let coordinate = try XCTUnwrap(OpenLocationCodeDecoder.coordinate(for: "849VCWC8+R9"))

        XCTAssertEqual(coordinate.latitude, 37.422, accuracy: 0.001)
        XCTAssertEqual(coordinate.longitude, -122.084, accuracy: 0.001)
        XCTAssertNil(OpenLocationCodeDecoder.coordinate(for: "not-a-plus-code"))
    }

    func testExistingProfileRouteUsesStoredSessionCookie() async throws {
        let credentialStore = InMemorySessionCredentialStore()
        XCTAssertTrue(credentialStore.save(
            SessionCredentials(cookieHeader: "connect.sid=signed-session", username: "traveller")
        ))

        var recordedRequest: URLRequest?
        APIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (
                response,
                Data(
                    #"{"username":"traveller","displayName":"A Traveller","public":true,"seen":"2026-07-29T12:00:00Z","replyRate":"82%","replyTime":"4 hours"}"#.utf8
                )
            )
        }
        defer { APIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        let member = try await api.profile(
            serverURLString: "https://api.example.test",
            username: "traveller"
        )

        XCTAssertEqual(member.username, "traveller")
        XCTAssertNotNil(member.seen)
        XCTAssertEqual(member.replyRate, "82%")
        XCTAssertEqual(member.replyTime, "4 hours")
        XCTAssertEqual(recordedRequest?.url?.path, "/api/users/traveller")
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Cookie"), "connect.sid=signed-session")
        XCTAssertNil(recordedRequest?.value(forHTTPHeaderField: "Authorization"))
    }

    func testMemberSearchUsesExistingProtectedRouteAndDecodesNativeResults() async throws {
        let credentialStore = InMemorySessionCredentialStore()
        XCTAssertTrue(credentialStore.save(
            SessionCredentials(cookieHeader: "connect.sid=signed-session", username: "traveller")
        ))

        var recordedRequest: URLRequest?
        APIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (
                response,
                Data(
                    #"[{"_id":"member-1","username":"alex","displayName":"Alex Traveller","locationLiving":"Lisbon"}]"#.utf8
                )
            )
        }
        defer { APIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        let members = try await api.searchMembers(
            serverURLString: "https://api.example.test",
            query: "alex"
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/users")
        XCTAssertEqual(
            URLComponents(url: try XCTUnwrap(recordedRequest?.url), resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "search" })?
                .value,
            "alex"
        )
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Cookie"), "connect.sid=signed-session")
        XCTAssertEqual(members.first?.username, "alex")
        XCTAssertEqual(members.first?.displayName, "Alex Traveller")
        XCTAssertEqual(members.first?.locationSummary, "Lisbon")
    }

    func testMemberReportUsesExistingSupportRouteWithReportedUsername() async throws {
        let credentialStore = InMemorySessionCredentialStore()
        XCTAssertTrue(credentialStore.save(
            SessionCredentials(cookieHeader: "connect.sid=signed-session", username: "traveller")
        ))

        var recordedRequest: URLRequest?
        var recordedBody: Data?
        APIURLProtocol.handler = { request in
            recordedRequest = request
            recordedBody = request.bodyData
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(#"{"message":"Support request sent."}"#.utf8))
        }
        defer { APIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        try await api.sendSupportMessage(
            serverURLString: "https://api.example.test",
            message: "This profile contains abusive content.",
            reportMember: "reported-member"
        )

        let body = try JSONDecoder().decode(
            [String: String].self,
            from: try XCTUnwrap(recordedBody)
        )
        XCTAssertEqual(recordedRequest?.url?.path, "/api/support")
        XCTAssertEqual(recordedRequest?.httpMethod, "POST")
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Cookie"), "connect.sid=signed-session")
        XCTAssertEqual(body["reportMember"], "reported-member")
        XCTAssertEqual(body["message"], "This profile contains abusive content.")
    }

    func testMemberBlockUsesExistingBlockedMemberRoute() async throws {
        let credentialStore = InMemorySessionCredentialStore()
        XCTAssertTrue(credentialStore.save(
            SessionCredentials(cookieHeader: "connect.sid=signed-session", username: "traveller")
        ))

        var recordedRequest: URLRequest?
        APIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data("Member added to block list.".utf8))
        }
        defer { APIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        try await api.setMemberBlocked(
            serverURLString: "https://api.example.test",
            username: "reported-member",
            blocked: true
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/blocked-users/reported-member")
        XCTAssertEqual(recordedRequest?.httpMethod, "PUT")
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Cookie"), "connect.sid=signed-session")
    }

    func testAccommodationUsesExistingOfferByUserRoute() async throws {
        let credentialStore = InMemorySessionCredentialStore()
        XCTAssertTrue(credentialStore.save(
            SessionCredentials(cookieHeader: "connect.sid=signed-session", username: "traveller")
        ))

        var recordedRequest: URLRequest?
        APIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (
                response,
                Data(#"[{"_id":"offer-1","status":"yes","description":"A sofa","maxGuests":2}]"#.utf8)
            )
        }
        defer { APIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        let offer = try await api.accommodationOffer(
            serverURLString: "https://api.example.test",
            userID: "member-1"
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/offers-by/member-1")
        XCTAssertEqual(recordedRequest?.url?.query, "types=host")
        XCTAssertEqual(offer?.status, "yes")
        XCTAssertEqual(offer?.maxGuests, 2)
    }

    func testSignInUsesExistingRouteAndCapturesSessionCookie() async throws {
        var recordedRequest: URLRequest?
        APIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: [
                    "Set-Cookie": "connect.sid=s%3Atest.signature; Path=/; Expires=Wed, 26 Aug 2026 12:00:00 GMT; HttpOnly"
                ]
            )!
            return (
                response,
                Data(#"{"username":"traveller","displayName":"A Traveller","public":true,"email":"traveller@example.test","newsletter":true}"#.utf8)
            )
        }
        defer { APIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration))

        let websiteSession = try await api.signIn(
            serverURLString: "https://api.example.test",
            usernameOrEmail: "traveller",
            password: "password"
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/auth/signin")
        XCTAssertEqual(websiteSession.member.email, "traveller@example.test")
        XCTAssertEqual(
            websiteSession.credentials,
            SessionCredentials(
                cookieHeader: "connect.sid=s%3Atest.signature",
                username: "traveller"
            )
        )
    }

    func testOfflineResponseCacheIsScopedAndRetainsTimestamp() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("trustroots-cache-test-\(UUID().uuidString)", isDirectory: true)
        defer {
            try? FileManager.default.removeItem(at: directory)
            UserDefaults.standard.removeObject(forKey: OfflineResponseCache.scopeDefaultsKey)
        }
        let cache = OfflineResponseCache(directory: directory)
        let url = try XCTUnwrap(URL(string: "https://example.test/api/users/anonymous"))
        let payload = Data(#"{"username":"anonymous"}"#.utf8)
        UserDefaults.standard.set("example.test|member-a", forKey: OfflineResponseCache.scopeDefaultsKey)

        try await cache.save(payload, for: url)
        let cached = await cache.response(for: url)
        XCTAssertEqual(cached?.data, payload)
        XCTAssertNotNil(cached?.savedAt)

        await cache.clear()
        let clearedResponse = await cache.response(for: url)
        XCTAssertNil(clearedResponse)

        UserDefaults.standard.set("example.test|member-b", forKey: OfflineResponseCache.scopeDefaultsKey)
        let otherMemberResponse = await cache.response(for: url)
        XCTAssertNil(otherMemberResponse)
    }
}

private final class APIURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.host == "api.example.test"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            fatalError("API test handler was not configured")
        }
        let (response, data) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private final class InMemorySessionCredentialStore: SessionCredentialStoring {
    private var credentials: SessionCredentials?

    func load() -> SessionCredentials? {
        credentials
    }

    @discardableResult
    func save(_ credentials: SessionCredentials) -> Bool {
        self.credentials = credentials
        return true
    }

    func delete() {
        credentials = nil
    }
}

private extension URLRequest {
    var bodyData: Data? {
        if let httpBody {
            return httpBody
        }
        guard let stream = httpBodyStream else {
            return nil
        }

        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while true {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count < 0 {
                return nil
            }
            if count == 0 {
                return data
            }
            data.append(buffer, count: count)
        }
    }
}
