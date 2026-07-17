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

    func testLocalAPIConfigurationAcceptsTheDefaultDevelopmentServer() {
        let configuration = TrustrootsAPIConfiguration(
            baseURLString: TrustrootsAPIConfiguration.localDefaultURLString
        )

        XCTAssertEqual(configuration?.baseURL.host, "127.0.0.1")
        XCTAssertEqual(configuration?.baseURL.port, 13001)
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

    func testAPIConfigurationAcceptsEveryDebugSimulatorLoopbackForm() {
        XCTAssertNotNil(TrustrootsAPIConfiguration(baseURLString: "http://localhost:13001"))
        XCTAssertNotNil(TrustrootsAPIConfiguration(baseURLString: "http://127.0.0.1:13001"))
        XCTAssertNotNil(TrustrootsAPIConfiguration(baseURLString: "http://[::1]:13001"))
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

    func testMobileSessionDecodesBearerCredentialsAndMember() throws {
        let payload = Data(
            #"{"accessToken":"access","refreshToken":"refresh","accessTokenExpiresAt":"2026-07-16T11:00:00Z","member":{"username":"traveller","displayName":"A Traveller","public":true,"email":"traveller@example.test","newsletter":true}}"#.utf8
        )
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let mobileSession = try decoder.decode(MobileSessionResponse.self, from: payload)

        XCTAssertEqual(mobileSession.credentials, MobileCredentials(accessToken: "access", refreshToken: "refresh"))
        XCTAssertEqual(mobileSession.member.email, "traveller@example.test")
        XCTAssertEqual(mobileSession.member.newsletter, true)
    }

    func testNativeURLSessionDoesNotPersistBrowserCookies() {
        XCTAssertFalse(URLSession.trustroots.configuration.httpShouldSetCookies)
        XCTAssertEqual(URLSession.trustroots.configuration.httpCookieAcceptPolicy, .never)
        XCTAssertNil(URLSession.trustroots.configuration.httpCookieStorage)
    }

    func testMapOfferUsesGeoJSONLongitudeThenLatitudeCoordinates() {
        let offer = MapOffer(
            properties: .init(id: "offer-1", type: "host", status: "yes"),
            geometry: .init(coordinates: [-9.1393, 38.7223])
        )

        XCTAssertEqual(offer.coordinate?.latitude, 38.7223)
        XCTAssertEqual(offer.coordinate?.longitude, -9.1393)
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

    func testMobileBearerRequestRefreshesOnceAndRetriesWithTheRotatedToken() async throws {
        let credentialStore = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentialStore.save(
            MobileCredentials(accessToken: "expired-access", refreshToken: "valid-refresh")
        ))

        var requests: [(path: String, authorization: String?)] = []
        MobileAPIURLProtocol.handler = { request in
            requests.append((request.url?.path ?? "", request.value(forHTTPHeaderField: "Authorization")))

            let response: HTTPURLResponse
            let body: Data
            switch request.url?.path {
            case "/api/mobile/v0/me":
                if request.value(forHTTPHeaderField: "Authorization") == "Bearer expired-access" {
                    response = HTTPURLResponse(
                        url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil
                    )!
                    body = Data(#"{"code":"authentication_required"}"#.utf8)
                } else {
                    response = HTTPURLResponse(
                        url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                    )!
                    body = Data(#"{"member":{"username":"traveller","displayName":"A Traveller","public":true}}"#.utf8)
                }
            case "/api/mobile/v0/auth/refresh":
                response = HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                )!
                body = Data(#"{"accessToken":"rotated-access","refreshToken":"rotated-refresh","accessTokenExpiresAt":"2026-07-16T11:00:00Z","member":{"username":"traveller","displayName":"A Traveller","public":true}}"#.utf8)
            default:
                response = HTTPURLResponse(
                    url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil
                )!
                body = Data()
            }
            return (response, body)
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        let member = try await api.currentMember(serverURLString: "https://api.example.test")

        XCTAssertEqual(member.username, "traveller")
        let recordedRequests = requests
        XCTAssertEqual(recordedRequests.map(\.path), [
            "/api/mobile/v0/me",
            "/api/mobile/v0/auth/refresh",
            "/api/mobile/v0/me",
        ])
        XCTAssertEqual(recordedRequests[0].authorization, "Bearer expired-access")
        XCTAssertNil(recordedRequests[1].authorization)
        XCTAssertEqual(recordedRequests[2].authorization, "Bearer rotated-access")
        XCTAssertEqual(
            credentialStore.load(),
            MobileCredentials(accessToken: "rotated-access", refreshToken: "rotated-refresh")
        )
    }

    func testSignInExplainsWhenTheSelectedServerLacksTheMobileAPI() async {
        MobileAPIURLProtocol.handler = { request in
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil
            )!
            return (response, Data())
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration))

        do {
            _ = try await api.signIn(
                serverURLString: "https://api.example.test",
                usernameOrEmail: "traveller",
                password: "password"
            )
            XCTFail("Expected sign-in to fail")
        } catch {
            XCTAssertEqual(
                error.localizedDescription,
                "This API server has not been updated for the mobile app yet. It is missing /api/mobile/v0."
            )
        }
    }

    func testConcurrentMobileRefreshesShareOneRotation() async throws {
        let coordinator = MobileRefreshCoordinator()
        let counter = RefreshOperationCounter()

        async let first = coordinator.refresh(serverURLString: "https://api.example.test") {
            await counter.rotate()
        }
        async let second = coordinator.refresh(serverURLString: "https://api.example.test") {
            await counter.rotate()
        }
        let credentials = try await [first, second]

        XCTAssertEqual(credentials, [
            MobileCredentials(accessToken: "rotated-access", refreshToken: "rotated-refresh"),
            MobileCredentials(accessToken: "rotated-access", refreshToken: "rotated-refresh"),
        ])
        let calls = await counter.calls
        XCTAssertEqual(calls, 1)
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

private final class MobileAPIURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.host == "api.example.test"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            fatalError("Mobile API test handler was not configured")
        }
        let (response, data) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private final class InMemoryMobileCredentialStore: MobileCredentialStoring {
    private var credentials: MobileCredentials?

    func load() -> MobileCredentials? {
        credentials
    }

    @discardableResult
    func save(_ credentials: MobileCredentials) -> Bool {
        self.credentials = credentials
        return true
    }

    func delete() {
        credentials = nil
    }
}

private actor RefreshOperationCounter {
    private(set) var calls = 0

    func rotate() async -> MobileCredentials {
        calls += 1
        try? await Task.sleep(for: .milliseconds(25))
        return MobileCredentials(accessToken: "rotated-access", refreshToken: "rotated-refresh")
    }
}
