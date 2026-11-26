import CryptoKit
import XCTest
import Dispatch
import MapKit
@testable import Trustroots

final class TrustrootsTests: XCTestCase {
    func testDirectMessageDecodesMultilineTextAndSupportsOlderServers() throws {
        let decoder = JSONDecoder()
        let current = Data(#"{"_id":"message-1","content":"<p>First</p><p>Second</p>","plainText":"First\n\nSecond","userFrom":{"_id":"member-1","username":"first"}}"#.utf8)
        let legacy = Data(#"{"_id":"message-1","content":"<p>Legacy message</p>","userFrom":{"_id":"member-1","username":"first"}}"#.utf8)

        XCTAssertEqual(try decoder.decode(DirectMessage.self, from: current).displayText, "First\n\nSecond")
        XCTAssertEqual(try decoder.decode(DirectMessage.self, from: legacy).displayText, "Legacy message")
    }

    func testNostranslationConnectionLinkRequiresThePinnedClientAndRelay() {
        let peer = String(repeating: "a", count: 64)
        let valid = "nostrconnect://\(peer)?relay=wss%3A%2F%2Frelay.trustroots.org&url=https%3A%2F%2Fteam.trustroots.org%2Fnostranslation&perms=sign_event%3A27235&secret=fixture"
        XCTAssertEqual(NostranslationLink(valid)?.peer, peer)
        XCTAssertEqual(NostranslationLink(valid)?.secret, "fixture")
        for invalid in [
            valid + "&secret=duplicate",
            valid + "#fragment",
            valid.replacingOccurrences(of: "relay.trustroots.org", with: "relay.example.test"),
            valid.replacingOccurrences(of: "27235", with: "1"),
            valid.replacingOccurrences(of: "nostrconnect", with: "https")
        ] {
            XCTAssertNil(NostranslationLink(invalid))
        }
    }

    func testMemberIdentityPrefersDisplayNameAndShowsHandleBelow() {
        let identity = MemberIdentityText(
            member: MiniMember(id: "member-1", username: "traveller", displayName: "A Traveller")
        )

        XCTAssertEqual(identity.primary, "A Traveller")
        XCTAssertEqual(identity.secondary, "@traveller")
    }

    func testMemberIdentityUsesHandleAsPrimaryWhenDisplayNameIsMissing() {
        let identity = MemberIdentityText(
            member: MiniMember(id: "member-2", username: "traveller", displayName: "  ")
        )

        XCTAssertEqual(identity.primary, "@traveller")
        XCTAssertNil(identity.secondary)
    }

    func testMemberIdentityHasAccessibleFallbackWhenNameAndHandleAreMissing() {
        let identity = MemberIdentityText(
            member: MiniMember(id: nil, username: nil, displayName: nil)
        )

        XCTAssertEqual(identity.primary, "Unknown member")
        XCTAssertNil(identity.secondary)
    }

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

    func testHostingDetailsValidationRequiresRealCompleteDateRange() {
        XCTAssertNil(HostingDetailsValidation.error(guests: 1, arrival: "", departure: ""))
        XCTAssertNil(HostingDetailsValidation.error(guests: 3, arrival: "2027-02-28", departure: "2027-03-01"))
        XCTAssertNotNil(HostingDetailsValidation.error(guests: 1, arrival: "2027-02-30", departure: "2027-03-01"))
        XCTAssertNotNil(HostingDetailsValidation.error(guests: 1, arrival: "2027-02-28", departure: ""))
        XCTAssertNotNil(HostingDetailsValidation.error(guests: 1, arrival: "2027-03-01", departure: "2027-02-28"))
        XCTAssertNotNil(HostingDetailsValidation.error(guests: 101, arrival: "", departure: ""))
    }

    func testHostingReplyOnlyShowsForUnansweredIncomingHostingMessage() {
        let me = MiniMember(id: "member-me", username: "me", displayName: "Me")
        let them = MiniMember(id: "member-them", username: "them", displayName: "Them")
        let hostingMessage = DirectMessage(
            id: "hosting-1",
            content: "Are you available?",
            userFrom: them,
            created: nil,
            hostingDetails: HostingMessageDetails(guests: 2, arrival: nil, departure: nil)
        )
        let ordinaryMessage = DirectMessage(
            id: "ordinary-1",
            content: "Hi",
            userFrom: them,
            created: nil,
            hostingDetails: nil
        )
        let outgoingMessage = DirectMessage(
            id: "outgoing-1",
            content: "Thanks",
            userFrom: me,
            created: nil,
            hostingDetails: nil
        )

        XCTAssertTrue(HostingReplyPolicy.shouldShow(messages: [hostingMessage, ordinaryMessage], username: "me"))
        XCTAssertTrue(HostingReplyPolicy.shouldShow(messages: [hostingMessage, outgoingMessage], username: "me"))
        XCTAssertFalse(HostingReplyPolicy.shouldShow(messages: [outgoingMessage, hostingMessage], username: "me"))
        XCTAssertFalse(HostingReplyPolicy.shouldShow(messages: [ordinaryMessage], username: "me"))
    }

    func testDirectMessageWithoutHostingMetadataDecodesAsOrdinaryMessage() throws {
        let message = try JSONDecoder().decode(
            DirectMessage.self,
            from: Data(#"{"_id":"message-1","content":"Hello","userFrom":{"username":"traveller"}}"#.utf8)
        )
        XCTAssertNil(message.hostingDetails)
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

    func testBuildDefaultsToLiveTrustrootsOutsideDebugSimulator() {
#if DEBUG && targetEnvironment(simulator)
        XCTAssertEqual(TrustrootsAPIConfiguration.buildDefaultURLString, "http://127.0.0.1:13001")
#else
        XCTAssertEqual(TrustrootsAPIConfiguration.buildDefaultURLString, "https://www.trustroots.org")
#endif
    }

    @MainActor
    func testRetiredPreviewSessionDoesNotCarryCredentialsToDefaultServer() throws {
        let defaults = UserDefaults.standard
        let serverKey = "trustroots.apiServerURL"
        let memberKey = "trustroots.signedInMember"
        let previousServer = defaults.object(forKey: serverKey)
        let previousMember = defaults.object(forKey: memberKey)
        let previousScope = defaults.object(forKey: OfflineResponseCache.scopeDefaultsKey)
        defer {
            defaults.set(previousServer, forKey: serverKey)
            defaults.set(previousMember, forKey: memberKey)
            defaults.set(previousScope, forKey: OfflineResponseCache.scopeDefaultsKey)
        }
        defaults.set("https://pr2777.test.trustroots.org", forKey: serverKey)
        let member = SignedInMember(username: "mira", displayName: "Mira Example", isPublic: true, email: nil, newsletter: nil)
        defaults.set(try JSONEncoder().encode(member), forKey: memberKey)
        let credentials = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentials.save(MobileCredentials(accessToken: "example-access", refreshToken: "example-refresh")))

        let session = MemberSessionStore(
            credentialStore: credentials,
            nostrIdentity: NostrIdentityManager(keyStore: InMemoryNostrKeyStorage(), clearPermissions: {})
        )

        XCTAssertEqual(session.serverURLString, TrustrootsAPIConfiguration.buildDefaultURLString)
        XCTAssertNil(session.member)
        XCTAssertNil(credentials.load())
        XCTAssertNil(defaults.object(forKey: serverKey))
        XCTAssertNil(defaults.object(forKey: memberKey))
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
        let secret = try NostrKeyCodec.generateSecret()

        XCTAssertTrue(NostrKeyCodec.isSecretHex(secret))
        XCTAssertEqual(try NostrKeyCodec.importSecret(secret), secret)
    }

    func testNostrPublicKeyCanBeShownAsNpub() throws {
        let publicKey = try NostrCrypto.publicKey(secret: NostrKeyCodec.generateSecret())
        let npub = try XCTUnwrap(NostrCrypto.npub(publicKey: publicKey))

        XCTAssertTrue(npub.hasPrefix("npub1"))
        XCTAssertNotEqual(npub, publicKey)
    }

    func testNostrProfileChallengeSignsOnlyTheConfiguredServerOwnershipEvent() throws {
        let server = "https://api.example.test"
        let method = ["method", "PUT"]
        let nonce = ["challenge", String(repeating: "a", count: 64)]
        let endpoint = ["u", server + "/api/users"]
        let event: [String: Any] = [
            "kind": 27235, "created_at": Int(Date().timeIntervalSince1970), "content": "",
            "tags": [endpoint, method, nonce],
        ]
        let proof = try NIP07Bridge.signProfileChallenge(event, serverURLString: server, secret: NostrTestKeys.first)
        XCTAssertEqual(proof["tags"] as? [[String]], [endpoint, method, nonce])
        XCTAssertEqual((proof["id"] as? String)?.count, 64)
        XCTAssertEqual((proof["sig"] as? String)?.count, 128)
        for tags in [
            [["u", "https://other.example.test/api/users"], method, nonce],
            [["u", server + "/unrelated"], method, nonce],
            [endpoint, ["method", "POST"], nonce],
            [endpoint, method, ["challenge", "invalid"]],
            [endpoint, method, nonce, ["payload", String(repeating: "a", count: 64)]],
        ] {
            var invalid = event
            invalid["tags"] = tags
            XCTAssertThrowsError(try NIP07Bridge.signProfileChallenge(
                invalid, serverURLString: server, secret: NostrTestKeys.first
            ))
        }
    }

    @MainActor
    func testNostrIdentityRequiresActiveAccountBeforeWritingOrSigning() throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})

        XCTAssertFalse(identity.isActive)
        XCTAssertNil(identity.secret())
        XCTAssertThrowsError(try identity.import(NostrTestKeys.first))
        XCTAssertThrowsError(try identity.generate())
        XCTAssertThrowsError(try identity.remove())
        XCTAssertThrowsError(try identity.claimLegacy())
        XCTAssertTrue(storage.values.isEmpty)
    }

    @MainActor
    func testNostrKeysAreIsolatedByServerAndAccountAndResumeAfterPause() throws {
        let storage = InMemoryNostrKeyStorage()
        var permissionClears = 0
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: { permissionClears += 1 })
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)
        let firstPublicKey = identity.npub
        let firstRevision = identity.revision

        identity.activate(serverURLString: "https://api.example.test", username: "robin")
        XCTAssertFalse(identity.hasKey)
        XCTAssertNil(identity.secret())
        XCTAssertFalse(identity.isCurrent(firstRevision))
        try identity.import(NostrTestKeys.second)
        XCTAssertNotEqual(identity.npub, firstPublicKey)

        identity.activate(serverURLString: "https://other.example.test", username: "mira")
        XCTAssertNil(identity.secret())
        XCTAssertFalse(identity.hasKey)
        XCTAssertEqual(storage.values.count, 2)

        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertEqual(identity.npub, firstPublicKey)
        let beforePause = identity.revision
        identity.pause()
        XCTAssertFalse(identity.isActive)
        XCTAssertNil(identity.publicKey)
        XCTAssertNil(identity.npub)
        XCTAssertNil(identity.secret())
        XCTAssertFalse(identity.isCurrent(beforePause))
        XCTAssertEqual(storage.values.count, 2)

        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertFalse(identity.isCurrent(beforePause))
        XCTAssertGreaterThanOrEqual(permissionClears, 7)
    }

    @MainActor
    func testNostrScopeCanonicalisesDefaultPortTrailingSlashAndUsernameCase() throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)
        let revision = identity.revision

        identity.activate(serverURLString: "HTTPS://API.EXAMPLE.TEST:443/", username: "MIRA")
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertEqual(identity.revision, revision)
        XCTAssertEqual(storage.values.count, 1)

        identity.activate(serverURLString: "https://api.example.test:8443", username: "mira")
        XCTAssertNil(identity.secret())
        XCTAssertFalse(identity.hasKey)
    }

    @MainActor
    func testNostrInvalidAccountOrServerPausesExistingIdentity() throws {
        for (server, username) in [
            ("https://api.example.test", "  "),
            ("not a server", "mira"),
            ("https://api.example.test/private-path", "mira"),
            ("https://name:password@api.example.test", "mira"),
        ] {
            let storage = InMemoryNostrKeyStorage()
            let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
            identity.activate(serverURLString: "https://api.example.test", username: "mira")
            try identity.import(NostrTestKeys.first)
            let revision = identity.revision
            identity.activate(serverURLString: server, username: username)
            XCTAssertFalse(identity.isActive, server)
            XCTAssertNil(identity.secret(), server)
            XCTAssertFalse(identity.isCurrent(revision), server)
            XCTAssertEqual(storage.values.count, 1)
        }
    }

    @MainActor
    func testNostrExistingKeyCannotBeOverwrittenByImportGenerationOrLegacyClaim() throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.second
        let revision = identity.revision

        XCTAssertThrowsError(try identity.import(NostrTestKeys.second))
        XCTAssertThrowsError(try identity.generate())
        XCTAssertThrowsError(try identity.claimLegacy())
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertEqual(identity.revision, revision)
        XCTAssertEqual(storage.values[NostrIdentityManager.legacyAccount], NostrTestKeys.second)
    }

    @MainActor
    func testNostrLocalRemovalInvalidatesSigningAndRetainsOtherAccounts() throws {
        let storage = InMemoryNostrKeyStorage()
        var permissionClears = 0
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: { permissionClears += 1 })
        identity.activate(serverURLString: "https://api.example.test", username: "robin")
        try identity.import(NostrTestKeys.second)
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)
        let beforeRemoval = identity.revision
        let beforeClears = permissionClears

        try identity.remove()
        XCTAssertNil(identity.secret())
        XCTAssertNil(identity.npub)
        XCTAssertFalse(identity.isCurrent(beforeRemoval))
        XCTAssertGreaterThan(permissionClears, beforeClears)
        XCTAssertEqual(storage.values.count, 1)
        identity.activate(serverURLString: "https://api.example.test", username: "robin")
        XCTAssertEqual(identity.secret(), NostrTestKeys.second)
    }

    @MainActor
    func testNostrLegacyKeyIsOnlyACandidateUntilExplicitClaim() throws {
        let storage = InMemoryNostrKeyStorage()
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.first
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        let candidate = try XCTUnwrap(identity.legacyNpub)
        XCTAssertFalse(identity.hasKey)
        XCTAssertNil(identity.secret())
        let revision = identity.revision
        try identity.considerLegacy(linkedNpub: nil, capturedRevision: revision)
        try identity.considerLegacy(linkedNpub: "npub1different", capturedRevision: revision)
        XCTAssertEqual(identity.legacyNpub, candidate)
        XCTAssertNil(identity.secret())

        try identity.claimLegacy()
        XCTAssertEqual(identity.npub, candidate)
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertNil(identity.legacyNpub)
        XCTAssertNil(storage.values[NostrIdentityManager.legacyAccount])
        XCTAssertNotNil(storage.values[NostrIdentityManager.legacyOwnerAccount])
        XCTAssertEqual(storage.values.count, 2)
        XCTAssertFalse(identity.isCurrent(revision))
    }

    @MainActor
    func testNostrLegacyAutoAdoptionRequiresMatchingLiveProfileAndCurrentRevision() throws {
        let storage = InMemoryNostrKeyStorage()
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.first
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        let candidate = try XCTUnwrap(identity.legacyNpub)
        let oldRevision = identity.revision
        identity.activate(serverURLString: "https://api.example.test", username: "robin")
        try identity.considerLegacy(linkedNpub: candidate, capturedRevision: oldRevision)
        XCTAssertNil(identity.secret())
        XCTAssertNotNil(storage.values[NostrIdentityManager.legacyAccount])

        try identity.considerLegacy(linkedNpub: candidate, capturedRevision: identity.revision)
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertNil(storage.values[NostrIdentityManager.legacyAccount])
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        XCTAssertNil(identity.secret())
        XCTAssertNil(identity.legacyNpub)
    }

    @MainActor
    func testNostrLegacyAdoptionWritesScopedCopyBeforeDeletingOriginal() throws {
        let storage = InMemoryNostrKeyStorage()
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.first
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        storage.mutations.removeAll()

        try identity.claimLegacy()
        XCTAssertEqual(storage.mutations.count, 3)
        XCTAssertEqual(storage.mutations[0], "save:\(NostrIdentityManager.legacyOwnerAccount)")
        XCTAssertTrue(storage.mutations[1].hasPrefix("save:nostr-v1:"))
        XCTAssertEqual(storage.mutations[2], "remove:\(NostrIdentityManager.legacyAccount)")
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
    }

    @MainActor
    func testNostrFailedMigrationSavePreservesLegacyKeyAndDoesNotDelete() throws {
        let storage = InMemoryNostrKeyStorage()
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.first
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        let revision = identity.revision
        storage.failSave = true

        XCTAssertThrowsError(try identity.claimLegacy())
        XCTAssertEqual(storage.values[NostrIdentityManager.legacyAccount], NostrTestKeys.first)
        XCTAssertEqual(storage.values.count, 1)
        XCTAssertNil(identity.secret())
        XCTAssertEqual(identity.revision, revision)
        XCTAssertFalse(storage.mutations.contains { $0.hasPrefix("remove:") })
    }

    @MainActor
    func testNostrFailedLegacyDeletionKeepsDurableScopedCopyAndSurfacesError() throws {
        let storage = InMemoryNostrKeyStorage()
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.first
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        let revision = identity.revision
        storage.failRemove = true

        XCTAssertThrowsError(try identity.claimLegacy())
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertNotNil(storage.values[NostrIdentityManager.legacyAccount])
        XCTAssertEqual(storage.values.count, 3)
        XCTAssertFalse(identity.isCurrent(revision))

        identity.activate(serverURLString: "https://api.example.test", username: "robin")
        XCTAssertNil(identity.legacyNpub)
        XCTAssertNil(identity.secret())
        XCTAssertThrowsError(try identity.claimLegacy())
        identity.activate(serverURLString: "https://other.example.test", username: "mira")
        XCTAssertNil(identity.legacyNpub)
        XCTAssertThrowsError(try identity.claimLegacy())
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
    }

    @MainActor
    func testNostrInterruptedMigrationReservesOwnerAndCanBeRetriedByThatAccount() throws {
        let storage = InMemoryNostrKeyStorage()
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.first
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        let candidate = try XCTUnwrap(identity.legacyNpub)
        storage.failScopedSave = true

        XCTAssertThrowsError(try identity.claimLegacy())
        XCTAssertEqual(storage.values[NostrIdentityManager.legacyAccount], NostrTestKeys.first)
        XCTAssertNotNil(storage.values[NostrIdentityManager.legacyOwnerAccount])
        XCTAssertEqual(storage.values.count, 2)
        XCTAssertNil(identity.secret())
        identity.activate(serverURLString: "https://api.example.test", username: "robin")
        XCTAssertNil(identity.legacyNpub)
        XCTAssertThrowsError(try identity.claimLegacy())

        storage.failScopedSave = false
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        XCTAssertEqual(identity.legacyNpub, candidate)
        try identity.claimLegacy()
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertNil(storage.values[NostrIdentityManager.legacyAccount])
    }

    @MainActor
    func testNostrFailedLocalRemovalPreservesCurrentKeyAndRevision() throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)
        let revision = identity.revision
        storage.failRemove = true

        XCTAssertThrowsError(try identity.remove())
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        XCTAssertEqual(identity.revision, revision)
    }

    @MainActor
    func testNostrReadFailureIsNotTreatedAsAnEmptyKeySlot() throws {
        let storage = InMemoryNostrKeyStorage()
        storage.failRead = true
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")

        XCTAssertNotNil(identity.errorMessage)
        XCTAssertFalse(identity.hasKey)
        XCTAssertThrowsError(try identity.import(NostrTestKeys.first))
        XCTAssertThrowsError(try identity.claimLegacy())
        XCTAssertTrue(storage.values.isEmpty)
        XCTAssertTrue(storage.mutations.isEmpty)
    }

    @MainActor
    func testNostrInvalidImportNeverReachesStorage() throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        let revision = identity.revision

        for input in ["not a private key", String(repeating: "0", count: 64), String(repeating: "f", count: 64)] {
            XCTAssertThrowsError(try identity.import(input))
        }
        XCTAssertTrue(storage.values.isEmpty)
        XCTAssertTrue(storage.mutations.isEmpty)
        XCTAssertEqual(identity.revision, revision)
    }

    @MainActor
    func testNostrBackupAuthenticatesBeforeRevealingRestorableNsec() async throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)
        var authenticationCalls = 0

        let backup = try await identity.backup(authenticate: { authenticationCalls += 1 })
        XCTAssertEqual(authenticationCalls, 1)
        XCTAssertEqual(try NostrKeyCodec.importSecret(backup), NostrTestKeys.first)
        XCTAssertEqual(backup, NostrTestKeys.firstNsec)
    }

    @MainActor
    func testNostrBackupDoesNotRevealKeyWhenDeviceAuthenticationFails() async throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)

        do {
            _ = try await identity.backup(authenticate: { throw NostrTestFailure.denied })
            XCTFail("Denied device authentication must not produce a backup.")
        } catch NostrTestFailure.denied {
            XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        }
    }

    @MainActor
    func testNostrBackupRejectsAccountSwitchAndReturnDuringAuthentication() async throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)

        do {
            _ = try await identity.backup(authenticate: {
                identity.activate(serverURLString: "https://api.example.test", username: "robin")
                identity.activate(serverURLString: "https://api.example.test", username: "mira")
            })
            XCTFail("Authentication started in an earlier session must be retried.")
        } catch NostrIdentityError.inactiveSession {
            XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        }
    }

    @MainActor
    func testNostrBackupRejectsKeyReplacementDuringAuthentication() async throws {
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)

        do {
            _ = try await identity.backup(authenticate: {
                try identity.remove()
                try identity.import(NostrTestKeys.second)
            })
            XCTFail("Device authentication must not reveal a replacement key.")
        } catch NostrIdentityError.inactiveSession {
            XCTAssertEqual(identity.secret(), NostrTestKeys.second)
        }
    }

    @MainActor
    func testNostrBackupWithoutLocalKeyDoesNotPromptForAuthentication() async throws {
        let identity = NostrIdentityManager(keyStore: InMemoryNostrKeyStorage(), clearPermissions: {})
        var authenticationCalls = 0
        do {
            _ = try await identity.backup(authenticate: { authenticationCalls += 1 })
            XCTFail("A missing local key cannot be backed up.")
        } catch NostrIdentityError.missingKey {
            XCTAssertEqual(authenticationCalls, 0)
        }
    }

    func testNostrNsecUsesKnownBech32VectorAndAcceptsWholeStringUppercase() throws {
        XCTAssertEqual(try NostrKeyCodec.nsec(secret: NostrTestKeys.first), NostrTestKeys.firstNsec)
        XCTAssertEqual(try NostrKeyCodec.importSecret(NostrTestKeys.firstNsec), NostrTestKeys.first)
        XCTAssertEqual(try NostrKeyCodec.importSecret(" \n" + NostrTestKeys.firstNsec.uppercased() + "\n"), NostrTestKeys.first)
        XCTAssertEqual(try NostrKeyCodec.importSecret(String(repeating: "A", count: 64)), String(repeating: "a", count: 64))
        XCTAssertEqual(try NostrKeyCodec.importSecret(NostrKeyCodec.nsec(secret: NostrTestKeys.second)), NostrTestKeys.second)
    }

    func testNostrNsecRejectsChecksumMixedCaseNonCanonicalPaddingAndWrongLengths() throws {
        let malformed = [
            String(NostrTestKeys.firstNsec.dropLast()) + "q",
            "N" + NostrTestKeys.firstNsec.dropFirst(),
            // Valid checksums, but non-zero padding or 31/33-byte payloads.
            "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xpt74d",
            "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzanks0",
            "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsqjej2ms",
            "npub" + NostrTestKeys.firstNsec.dropFirst(4),
            "nsec1invalid!",
        ]
        for input in malformed {
            XCTAssertThrowsError(try NostrKeyCodec.importSecret(input))
        }
    }

    func testNostrPrivateKeysRejectZeroCurveOrderAndOutOfRangeScalars() throws {
        for secret in [
            String(repeating: "0", count: 64),
            "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
            String(repeating: "f", count: 64),
        ] {
            XCTAssertThrowsError(try NostrKeyCodec.importSecret(secret))
            XCTAssertThrowsError(try NostrKeyCodec.nsec(secret: secret))
        }
        XCTAssertThrowsError(try NostrKeyCodec.nsec(secret: "bad"))
    }

    @MainActor
    func testMemberSessionPausesNostrBeforeSignOutNetworkRequestCompletes() async throws {
        let defaults = UserDefaults.standard
        let previousMember = defaults.object(forKey: "trustroots.signedInMember")
        let previousScope = defaults.object(forKey: OfflineResponseCache.scopeDefaultsKey)
        defer {
            defaults.set(previousMember, forKey: "trustroots.signedInMember")
            defaults.set(previousScope, forKey: OfflineResponseCache.scopeDefaultsKey)
            MobileAPIURLProtocol.handler = nil
        }
        let member = SignedInMember(username: "mira", displayName: "Mira Example", isPublic: true, email: nil, newsletter: nil)
        defaults.set(try JSONEncoder().encode(member), forKey: "trustroots.signedInMember")
        let credentials = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentials.save(MobileCredentials(accessToken: "example-access", refreshToken: "example-refresh")))
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration), credentialStore: credentials)
        let identity = NostrIdentityManager(keyStore: InMemoryNostrKeyStorage(), clearPermissions: {})
        let session = MemberSessionStore(
            api: api,
            serverURLString: "https://api.example.test",
            credentialStore: credentials,
            nostrIdentity: identity
        )
        try identity.import(NostrTestKeys.first)
        let revision = identity.revision
        let requestStarted = expectation(description: "Sign-out request has started")
        let releaseResponse = DispatchSemaphore(value: 0)
        defer { releaseResponse.signal() }
        MobileAPIURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/mobile/v0/auth/signout")
            requestStarted.fulfill()
            _ = releaseResponse.wait(timeout: .now() + 10)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("{}".utf8))
        }

        let signOut = Task { await session.signOut() }
        await fulfillment(of: [requestStarted], timeout: 5)
        // The server response is still suspended: local signing must already be paused.
        XCTAssertNotNil(session.member)
        XCTAssertNotNil(credentials.load())
        XCTAssertFalse(identity.isActive)
        XCTAssertNil(identity.secret())
        XCTAssertFalse(identity.isCurrent(revision))
        let bridgeResponse = NIP07Bridge.handle(id: "signed-out", method: "getPublicKey", params: [], identity: identity)
        XCTAssertEqual(bridgeResponse["ok"] as? Bool, false)
        releaseResponse.signal()
        await signOut.value
        XCTAssertNil(session.member)
        XCTAssertNil(credentials.load())
    }

    @MainActor
    func testMemberSessionInvalidationAndServerChangePauseNostrWithoutDeletingKey() throws {
        let defaults = UserDefaults.standard
        let previousMember = defaults.object(forKey: "trustroots.signedInMember")
        let previousScope = defaults.object(forKey: OfflineResponseCache.scopeDefaultsKey)
        defer {
            defaults.set(previousMember, forKey: "trustroots.signedInMember")
            defaults.set(previousScope, forKey: OfflineResponseCache.scopeDefaultsKey)
        }
        defaults.removeObject(forKey: "trustroots.signedInMember")
        let storage = InMemoryNostrKeyStorage()
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        let credentials = InMemoryMobileCredentialStore()
        let session = MemberSessionStore(
            serverURLString: "https://api.example.test",
            credentialStore: credentials,
            nostrIdentity: identity
        )
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        try identity.import(NostrTestKeys.first)
        session.serverURLString = "https://other.example.test"
        XCTAssertFalse(identity.isActive)
        XCTAssertNil(identity.secret())
        XCTAssertEqual(storage.values.count, 1)

        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        XCTAssertEqual(identity.secret(), NostrTestKeys.first)
        session.invalidateSession()
        XCTAssertFalse(identity.isActive)
        XCTAssertNil(identity.secret())
        XCTAssertEqual(storage.values.count, 1)
    }

    func testMobileProfileDecodesOptionalNostrPublicKey() throws {
        let linked = try JSONDecoder().decode(
            MemberProfile.self,
            from: Data("{\"username\":\"mira\",\"nostrNpub\":\"\(NostrTestKeys.firstNpub)\"}".utf8)
        )
        let unlinked = try JSONDecoder().decode(MemberProfile.self, from: Data(#"{"username":"robin"}"#.utf8))
        XCTAssertEqual(linked.nostrNpub, NostrTestKeys.firstNpub)
        XCTAssertNil(unlinked.nostrNpub)
    }

    @MainActor
    func testLiveNostrProfileLookupCannotAdoptFromAnOfflineCachedProfile() async throws {
        let defaults = UserDefaults.standard
        let previousScope = defaults.object(forKey: OfflineResponseCache.scopeDefaultsKey)
        defer {
            defaults.set(previousScope, forKey: OfflineResponseCache.scopeDefaultsKey)
            MobileAPIURLProtocol.handler = nil
            OfflineAvailability.shared.showLiveData()
        }
        defaults.set("nostr-profile-test-\(UUID().uuidString)", forKey: OfflineResponseCache.scopeDefaultsKey)
        let payload = Data("{\"profile\":{\"username\":\"mira\",\"nostrNpub\":\"\(NostrTestKeys.firstNpub)\"}}".utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration), credentialStore: InMemoryMobileCredentialStore())
        MobileAPIURLProtocol.handler = { request in
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, payload)
        }
        _ = try await api.profile(serverURLString: "https://api.example.test", username: "mira")
        MobileAPIURLProtocol.handler = { _ in throw URLError(.notConnectedToInternet) }
        let cached = try await api.profile(serverURLString: "https://api.example.test", username: "mira")
        XCTAssertEqual(cached.nostrNpub, NostrTestKeys.firstNpub)

        let storage = InMemoryNostrKeyStorage()
        storage.values[NostrIdentityManager.legacyAccount] = NostrTestKeys.first
        let identity = NostrIdentityManager(keyStore: storage, clearPermissions: {})
        identity.activate(serverURLString: "https://api.example.test", username: "mira")
        MobileAPIURLProtocol.handler = { request in
            XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
            throw URLError(.notConnectedToInternet)
        }
        do {
            let live = try await api.profile(serverURLString: "https://api.example.test", username: "mira", allowSaved: false)
            try identity.considerLegacy(linkedNpub: live.nostrNpub, capturedRevision: identity.revision)
            XCTFail("Legacy adoption must require a live response rather than a saved profile.")
        } catch TrustrootsAPIError.requestFailed {
            XCTAssertFalse(identity.hasKey)
            XCTAssertEqual(identity.legacyNpub, NostrTestKeys.firstNpub)
            XCTAssertTrue(storage.mutations.isEmpty)
        }
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

    func testSelectedCommunityNoteKeepsLongTextAndNativeAttribution() {
        let text = (1...8).map { "Update \($0) from the café near the station." }.joined(separator: "\n")
        let note = CommunityNote(
            id: "synthetic-note",
            content: text,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            latitude: 37.422,
            longitude: -122.084
        )

        let presentation = CommunityNotePresentation(note: note)

        XCTAssertEqual(presentation.text, text)
        XCTAssertEqual(
            presentation.attribution,
            "via Nostroots · \(note.createdAt.formatted(date: .abbreviated, time: .omitted))"
        )
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

    func testEveryBearerMutationRetriesItsOriginalMethodAndBodyAfterRefresh() async throws {
        let server = "https://api.example.test"
        let operations: [(String, String, (TrustrootsAPI) async throws -> Void)] = [
            ("/messages", "POST", { api in
                _ = try await api.sendMessage(serverURLString: server, memberID: "recipient", content: "An example reply.")
            }),
            ("/profile", "PUT", { api in
                _ = try await api.updateProfile(serverURLString: server, displayName: "A Traveller", tagline: "Hello", description: "An example profile.", locationLiving: "", locationFrom: "", languages: ["eng"])
            }),
            ("/account", "PUT", { api in
                _ = try await api.updateAccount(serverURLString: server, email: "traveller@example.test", newsletter: false)
            }),
            ("/account/email-change", "POST", { api in
                _ = try await api.changeAccountEmail(
                    serverURLString: server, email: "new@example.test", currentPassword: "example", mfaCode: "ABCDEF-123456"
                )
            }),
            ("/account/email-change", "DELETE", { api in
                _ = try await api.cancelAccountEmailChange(serverURLString: server, newEmail: "new@example.test")
            }),
            ("/account/password", "POST", { api in
                try await api.changePassword(serverURLString: server, currentPassword: "old-password", newPassword: "new-password", verifyPassword: "new-password")
            }),
            ("/support", "POST", { api in
                try await api.sendSupportMessage(serverURLString: server, message: "An example support request.")
            }),
            ("/memberships/circle", "POST", { api in
                try await api.setCircleMembership(serverURLString: server, circleID: "circle", isMember: false)
            }),
            ("/memberships/circle", "DELETE", { api in
                try await api.setCircleMembership(serverURLString: server, circleID: "circle", isMember: true)
            }),
            ("/experiences", "POST", { api in
                _ = try await api.createExperience(serverURLString: server, memberID: "recipient", met: true, hosted: false, wasGuest: false, recommendation: "yes", feedback: "An example experience.")
            }),
            ("/messages-read", "POST", { api in
                try await api.markMessagesRead(serverURLString: server, messageIDs: ["111111111111111111111111"])
            }),
            ("/auth/signout", "POST", { api in
                await api.signOut(serverURLString: server)
            }),
        ]
        defer { MobileAPIURLProtocol.handler = nil }
        for (path, method, operation) in operations {
            let store = InMemoryMobileCredentialStore()
            store.save(MobileCredentials(accessToken: "expired-access", refreshToken: "valid-refresh"))
            let api = makeMobileAPI(store: store)
            var requests: [URLRequest] = []
            var bodies: [Data?] = []
            MobileAPIURLProtocol.handler = { request in
                requests.append(request)
                bodies.append(Self.body(of: request))
                if request.url!.path.hasSuffix("/auth/refresh") {
                    return self.mobileResponse(request, status: 200, body: self.rotatedSessionJSON)
                }
                if request.value(forHTTPHeaderField: "Authorization") == "Bearer expired-access" {
                    return self.mobileResponse(request, status: 401)
                }
                // A response that satisfies each of the resource-specific decoders.
                return self.mobileResponse(request, status: 200, body: #"{"_id":"example","username":"traveller","content":"An example reply.","userFrom":{"username":"traveller"}}"#)
            }

            try await operation(api)

            XCTAssertEqual(requests.map { $0.url!.path }, ["/api/mobile/v0\(path)", "/api/mobile/v0/auth/refresh", "/api/mobile/v0\(path)"], path)
            XCTAssertEqual(requests.first?.httpMethod, method, path)
            XCTAssertEqual(requests.last?.httpMethod, method, path)
            XCTAssertEqual(requests.first?.value(forHTTPHeaderField: "X-Trustroots-Request"), "1", path)
            XCTAssertEqual(requests.last?.value(forHTTPHeaderField: "X-Trustroots-Request"), "1", path)
            XCTAssertEqual(bodies.first!, bodies.last!, path)
            XCTAssertEqual(requests.last?.value(forHTTPHeaderField: "Authorization"), "Bearer rotated-access", path)
        }
    }

    func testDedicatedAccountEmailMutationsPreserveTheCurrentAddressAndBindCancellation() async throws {
        let server = "https://api.example.test"
        let credentials = MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh")
        let store = InMemoryMobileCredentialStore()
        store.save(credentials)
        let api = makeMobileAPI(store: store)
        var requests: [URLRequest] = []
        var bodies: [Data?] = []
        MobileAPIURLProtocol.handler = { request in
            requests.append(request)
            bodies.append(Self.body(of: request))
            switch requests.count {
            case 1, 2:
                return self.mobileResponse(request, status: 200, body: #"{"username":"traveller","email":"current@example.test","emailTemporary":"new@example.test","emailConfirmed":true,"mfaEnabled":true}"#)
            case 3:
                return self.mobileResponse(request, status: 409, body: #"{"message":"The pending email change has changed."}"#)
            default:
                return self.mobileResponse(request, status: 200, body: #"{"username":"traveller","email":"current@example.test","emailConfirmed":true,"mfaEnabled":true}"#)
            }
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let pending = try await api.changeAccountEmail(
            serverURLString: server, email: " new@example.test ", currentPassword: " p a s s ", mfaCode: " ABCDEF-123456 "
        )
        XCTAssertEqual(pending.email, "current@example.test")
        XCTAssertEqual(pending.emailTemporary, "new@example.test")
        XCTAssertEqual(pending.emailConfirmed, true)
        XCTAssertEqual(pending.mfaEnabled, true)
        _ = try await api.updateAccount(serverURLString: server, newsletter: true)
        do {
            _ = try await api.cancelAccountEmailChange(serverURLString: server, newEmail: "stale@example.test")
            XCTFail("Expected stale cancellation to be rejected")
        } catch {
            XCTAssertEqual(error as? TrustrootsAPIError, .serverMessage("The pending email change has changed."))
        }
        let cancelled = try await api.cancelAccountEmailChange(serverURLString: server, newEmail: "new@example.test")
        XCTAssertNil(cancelled.emailTemporary)
        XCTAssertEqual(cancelled.email, pending.email)
        XCTAssertEqual(store.load(), credentials)

        XCTAssertEqual(requests.map(\.httpMethod), ["POST", "PUT", "DELETE", "DELETE"])
        XCTAssertEqual(requests.map { $0.url?.path }, [
            "/api/mobile/v0/account/email-change", "/api/mobile/v0/account",
            "/api/mobile/v0/account/email-change", "/api/mobile/v0/account/email-change",
        ])
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer valid-access" })
        XCTAssertEqual(try JSONDecoder().decode([String: String].self, from: XCTUnwrap(bodies[0])), [
            "email": "new@example.test", "currentPassword": " p a s s ", "mfaCode": "ABCDEF-123456",
        ])
        XCTAssertEqual(try JSONDecoder().decode([String: Bool].self, from: XCTUnwrap(bodies[1])), ["newsletter": true])
        XCTAssertEqual(try JSONDecoder().decode([String: String].self, from: XCTUnwrap(bodies[2])), ["newEmail": "stale@example.test"])
        XCTAssertEqual(try JSONDecoder().decode([String: String].self, from: XCTUnwrap(bodies[3])), ["newEmail": "new@example.test"])
    }

    func testMutationDoesNotRetryAgainWhenRotatedAccessIsRejected() async throws {
        let store = InMemoryMobileCredentialStore()
        store.save(MobileCredentials(accessToken: "expired-access", refreshToken: "valid-refresh"))
        var paths: [String] = []
        MobileAPIURLProtocol.handler = { request in
            paths.append(request.url!.path)
            if request.url!.path.hasSuffix("/auth/refresh") {
                return self.mobileResponse(request, status: 200, body: self.rotatedSessionJSON)
            }
            return self.mobileResponse(request, status: 401)
        }
        defer { MobileAPIURLProtocol.handler = nil }
        do {
            try await makeMobileAPI(store: store).sendSupportMessage(serverURLString: "https://api.example.test", message: "An example request.")
            XCTFail("Expected authentication rejection")
        } catch {
            XCTAssertEqual(error as? TrustrootsAPIError, .authenticationRequired)
        }
        XCTAssertEqual(paths, ["/api/mobile/v0/support", "/api/mobile/v0/auth/refresh", "/api/mobile/v0/support"])
    }

    func testRejectedRefreshDoesNotReplayMutation() async throws {
        let store = InMemoryMobileCredentialStore()
        store.save(MobileCredentials(accessToken: "expired-access", refreshToken: "invalid-refresh"))
        var paths: [String] = []
        MobileAPIURLProtocol.handler = { request in
            paths.append(request.url!.path)
            return self.mobileResponse(request, status: 401)
        }
        defer { MobileAPIURLProtocol.handler = nil }
        do {
            try await makeMobileAPI(store: store).sendSupportMessage(serverURLString: "https://api.example.test", message: "An example request.")
            XCTFail("Expected authentication rejection")
        } catch {
            XCTAssertEqual(error as? TrustrootsAPIError, .authenticationRequired)
        }
        XCTAssertEqual(paths, ["/api/mobile/v0/support", "/api/mobile/v0/auth/refresh"])
    }

    func testForbiddenMutationDoesNotRotateOrReplay() async throws {
        let store = InMemoryMobileCredentialStore()
        store.save(MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh"))
        var requestCount = 0
        MobileAPIURLProtocol.handler = { request in
            requestCount += 1
            return self.mobileResponse(request, status: 403)
        }
        defer { MobileAPIURLProtocol.handler = nil }
        do {
            try await makeMobileAPI(store: store).sendSupportMessage(serverURLString: "https://api.example.test", message: "An example request.")
            XCTFail("Expected policy rejection")
        } catch {}
        XCTAssertEqual(requestCount, 1)
        XCTAssertEqual(store.load()?.refreshToken, "valid-refresh")
    }

    func testLateExpiredResponseUsesCredentialsAlreadyRotatedByAnotherRequest() async throws {
        let store = InMemoryMobileCredentialStore()
        store.save(MobileCredentials(accessToken: "expired-access", refreshToken: "valid-refresh"))
        var requestCount = 0
        MobileAPIURLProtocol.handler = { request in
            requestCount += 1
            XCTAssertEqual(request.url!.path, "/api/mobile/v0/support")
            if requestCount == 1 {
                store.save(MobileCredentials(accessToken: "rotated-access", refreshToken: "rotated-refresh"))
                return self.mobileResponse(request, status: 401)
            }
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer rotated-access")
            return self.mobileResponse(request, status: 200)
        }
        defer { MobileAPIURLProtocol.handler = nil }
        try await makeMobileAPI(store: store).sendSupportMessage(serverURLString: "https://api.example.test", message: "An example request.")
        XCTAssertEqual(requestCount, 2)
    }

    func testSearchRequestsReadOnlyContentAndAcknowledgementsUseBearerPOST() async throws {
        let store = InMemoryMobileCredentialStore()
        store.save(MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh"))
        let api = makeMobileAPI(store: store)
        var requests: [URLRequest] = []
        MobileAPIURLProtocol.handler = { request in
            requests.append(request)
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer valid-access")
            if request.httpMethod == "POST" {
                let body = try! JSONSerialization.jsonObject(with: Self.body(of: request)!) as! [String: [String]]
                XCTAssertEqual(body["messageIds"], ["111111111111111111111111"])
                return self.mobileResponse(request, status: 200)
            }
            return self.mobileResponse(request, status: 200, body: "[]")
        }
        defer { MobileAPIURLProtocol.handler = nil }
        _ = try await api.conversation(serverURLString: "https://api.example.test", memberID: "recipient", markRead: false)
        XCTAssertTrue(requests[0].url!.query!.contains("markRead=false"))
        XCTAssertEqual(requests.count, 1)
        try await api.markMessagesRead(serverURLString: "https://api.example.test", messageIDs: [])
        XCTAssertEqual(requests.count, 1)
        try await api.markMessagesRead(serverURLString: "https://api.example.test", messageIDs: ["111111111111111111111111"])
        XCTAssertEqual(requests.last?.url!.path, "/api/mobile/v0/messages-read")
        XCTAssertEqual(requests.last?.httpMethod, "POST")
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

    func testOfferSearchDefaultsToMembersSeenWithinSixMonths() async throws {
        let credentialStore = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentialStore.save(
            MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh")
        ))

        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(#"{"features":[]}"#.utf8))
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
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

        XCTAssertEqual(recordedRequest?.url?.path, "/api/mobile/v0/offers")
        XCTAssertEqual(seen?["months"] as? Int, 6)
        XCTAssertNil(filters?["volunteering"])
        XCTAssertNil(filters?["connectionsOnly"])

        _ = try await api.searchOffers(
            serverURLString: "https://api.example.test",
            in: MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 38.72, longitude: -9.14),
                span: MKCoordinateSpan(latitudeDelta: 1, longitudeDelta: 1)
            ),
            types: ["host", "meet"],
            tribeIDs: ["circle-one"],
            seenWithinMonths: nil,
            languages: ["eng"],
            volunteering: true,
            connectionsOnly: true
        )
        let selectedFiltersValue = URLComponents(
            url: try XCTUnwrap(recordedRequest?.url),
            resolvingAgainstBaseURL: false
        )?.queryItems?.first(where: { $0.name == "filters" })?.value
        let selectedData = try XCTUnwrap(selectedFiltersValue?.data(using: .utf8))
        let selected = try JSONSerialization.jsonObject(with: selectedData) as? [String: Any]
        XCTAssertEqual(selected?["types"] as? [String], ["host", "meet"])
        XCTAssertEqual(selected?["tribes"] as? [String], ["circle-one"])
        XCTAssertEqual(selected?["languages"] as? [String], ["eng"])
        XCTAssertEqual(selected?["volunteering"] as? Bool, true)
        XCTAssertEqual(selected?["connectionsOnly"] as? Bool, true)
        XCTAssertNil(selected?["seen"])
    }

    func testAboutRouteUsesTheDedicatedWebsitePage() {
        XCTAssertEqual(
            TrustrootsBrowserRoute.website(path: "/about", title: "About Trustroots").url.path,
            "/about"
        )
    }

    func testBearerProfileRetainsMainActivityFields() async throws {
        let credentialStore = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentialStore.save(
            MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh")
        ))

        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (
                response,
                Data(
                    #"{"profile":{"username":"traveller","displayName":"A Traveller","public":true,"seen":"2026-07-29T12:00:00Z","replyRate":"82%","replyTime":"4 hours"}}"#.utf8
                )
            )
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
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
        XCTAssertEqual(recordedRequest?.url?.path, "/api/mobile/v0/profiles/traveller")
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer valid-access")
        XCTAssertNil(recordedRequest?.value(forHTTPHeaderField: "Cookie"))
    }

    func testMemberSearchUsesMobileProtectedRouteAndDecodesNativeResults() async throws {
        let credentialStore = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentialStore.save(
            MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh")
        ))

        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
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
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        let members = try await api.searchMembers(
            serverURLString: "https://api.example.test",
            query: "fictional traveller",
            filters: MemberSearchFilters(
                hosts: true, meetings: true, volunteering: true, connectionsOnly: true,
                onlineRecently: true, circleIDs: ["000000000000000000000001"], languages: ["por", "eng"]
            )
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/mobile/v0/members")
        let queryItems = URLComponents(url: try XCTUnwrap(recordedRequest?.url), resolvingAgainstBaseURL: false)?
            .queryItems ?? []
        let parameters = Dictionary(uniqueKeysWithValues: queryItems.compactMap { item in
            item.value.map { (item.name, $0) }
        })
        XCTAssertEqual(parameters["search"], "fictional traveller")
        XCTAssertEqual(parameters["types"], "host,meet")
        XCTAssertEqual(parameters["volunteering"], "true")
        XCTAssertEqual(parameters["connectionsOnly"], "true")
        XCTAssertEqual(parameters["onlineRecently"], "true")
        XCTAssertEqual(parameters["tribes"], "000000000000000000000001")
        XCTAssertEqual(parameters["languages"], "eng,por")
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer valid-access")
        XCTAssertEqual(members.first?.username, "alex")
        XCTAssertEqual(members.first?.displayName, "Alex Traveller")
        XCTAssertEqual(members.first?.locationSummary, "Lisbon")
    }

    func testMemberReportUsesMobileSupportRouteWithReportedUsername() async throws {
        let credentialStore = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentialStore.save(
            MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh")
        ))

        var recordedRequest: URLRequest?
        var recordedBody: Data?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            recordedBody = Self.body(of: request)
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(#"{"message":"Support request sent."}"#.utf8))
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
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
        XCTAssertEqual(recordedRequest?.url?.path, "/api/mobile/v0/support")
        XCTAssertEqual(recordedRequest?.httpMethod, "POST")
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer valid-access")
        XCTAssertEqual(body["reportMember"], "reported-member")
        XCTAssertEqual(body["message"], "This profile contains abusive content.")
    }

    func testMemberBlockUsesMobileBlockedMemberRoute() async throws {
        let credentialStore = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentialStore.save(
            MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh")
        ))

        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data("Member added to block list.".utf8))
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        try await api.setMemberBlocked(
            serverURLString: "https://api.example.test",
            username: "reported-member",
            blocked: true
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/mobile/v0/blocked-users/reported-member")
        XCTAssertEqual(recordedRequest?.httpMethod, "PUT")
        XCTAssertEqual(recordedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer valid-access")
    }

    func testAccommodationUsesMobileOfferByUserRoute() async throws {
        let credentialStore = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentialStore.save(
            MobileCredentials(accessToken: "valid-access", refreshToken: "valid-refresh")
        ))

        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (
                response,
                Data(#"[{"_id":"offer-1","status":"yes","description":"A sofa","maxGuests":2}]"#.utf8)
            )
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: credentialStore
        )

        let offer = try await api.accommodationOffer(
            serverURLString: "https://api.example.test",
            userID: "member-1"
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/mobile/v0/offers-by/member-1")
        XCTAssertEqual(recordedRequest?.url?.query, "types=host")
        XCTAssertEqual(offer?.status, "yes")
        XCTAssertEqual(offer?.maxGuests, 2)
    }

    func testHostingOfferAPIHandlesNoOfferAndRetainsIDOnUpdate() async throws {
        let credentials = InMemoryMobileCredentialStore()
        XCTAssertTrue(credentials.save(
            MobileCredentials(accessToken: "fictional-access", refreshToken: "fictional-refresh")
        ))
        let api = makeMobileAPI(store: credentials)
        let server = "https://api.example.test"
        let update = HostingOfferUpdate(
            status: "no", meetingStatus: "yes", description: "Fictional details",
            noOfferDescription: "", maxGuests: 0, volunteering: true,
            showOnlyInMyCircles: true, location: [41.1, -8.5]
        )

        var requests: [URLRequest] = []
        MobileAPIURLProtocol.handler = { request in
            requests.append(request)
            switch request.httpMethod {
            case "GET":
                return self.mobileResponse(request, status: 404, body: #"{"message":"Not found."}"#)
            case "POST":
                return self.mobileResponse(request, status: 200, body: #"{"_id":"fictional-offer","message":"Offer created."}"#)
            default:
                return self.mobileResponse(request, status: 200, body: #"{"message":"Offer updated."}"#)
            }
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let existing = try await api.accommodationOffer(serverURLString: server, userID: "fictional-member", allowSaved: false)
        XCTAssertNil(existing)
        let created = try await api.saveHostingOffer(serverURLString: server, offerID: nil, update: update)
        XCTAssertEqual(created, "fictional-offer")
        let saved = try await api.saveHostingOffer(serverURLString: server, offerID: created, update: update)
        XCTAssertEqual(saved, created)
        XCTAssertEqual(requests.map(\.httpMethod), ["GET", "POST", "PUT"])
        XCTAssertEqual(requests.map { $0.url?.path }, [
            "/api/mobile/v0/offers-by/fictional-member",
            "/api/mobile/v0/offers",
            "/api/mobile/v0/offers/fictional-offer",
        ])
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer fictional-access" })
    }

    func testSendMessageEncodesHostingAcknowledgementAsBoolean() async throws {
        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(#"{"_id":"message-1","content":"Hello","userFrom":{"username":"traveller"},"hostingDetails":{"guests":2,"arrival":"2027-04-01","departure":"2027-04-04"}}"#.utf8))
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let api = makeMobileAPI(store: InMemoryMobileCredentialStore())
        let message = try await api.sendMessage(
            serverURLString: "https://api.example.test",
            memberID: "member-1",
            content: "Hello",
            hostingDescriptionAcknowledged: true,
            hostingDetails: HostingMessageDetails(guests: 2, arrival: "2027-04-01", departure: "2027-04-04")
        )

        let request = try XCTUnwrap(recordedRequest)
        let body = try XCTUnwrap(Self.body(of: request))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(object["hostingDescriptionAcknowledged"] as? Bool, true)
        let hostingDetails = try XCTUnwrap(object["hostingDetails"] as? [String: Any])
        XCTAssertEqual(hostingDetails["guests"] as? Int, 2)
        XCTAssertEqual(hostingDetails["arrival"] as? String, "2027-04-01")
        XCTAssertEqual(hostingDetails["departure"] as? String, "2027-04-04")
        XCTAssertEqual(message.hostingDetails, HostingMessageDetails(guests: 2, arrival: "2027-04-01", departure: "2027-04-04"))
    }

    func testHostingContextUsesMessagesHostingEndpoint() async throws {
        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(#"{"description":"A quiet room","acknowledgementRequired":true}"#.utf8))
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let api = makeMobileAPI(store: InMemoryMobileCredentialStore())
        let context = try await api.hostingContext(
            serverURLString: "https://api.example.test",
            userID: "member-1"
        )

        XCTAssertEqual(recordedRequest?.url?.path, "/api/mobile/v0/messages-hosting")
        XCTAssertEqual(recordedRequest?.url?.query, "userTo=member-1")
        XCTAssertEqual(context, HostingContext(description: "A quiet room", acknowledgementRequired: true))
    }

    func testSendMessageOmitsOptionalHostingAcknowledgementByDefault() async throws {
        var recordedRequest: URLRequest?
        MobileAPIURLProtocol.handler = { request in
            recordedRequest = request
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(#"{"_id":"message-1","content":"Hello","userFrom":{"username":"traveller"}}"#.utf8))
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let api = makeMobileAPI(store: InMemoryMobileCredentialStore())
        _ = try await api.sendMessage(
            serverURLString: "https://api.example.test",
            memberID: "member-1",
            content: "Hello"
        )

        let request = try XCTUnwrap(recordedRequest)
        let body = try XCTUnwrap(Self.body(of: request))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertNil(object["hostingDescriptionAcknowledged"])
        XCTAssertNil(object["hostingDetails"])
    }

    func testSendMessageRecognizesHostingAcknowledgementError() async throws {
        MobileAPIURLProtocol.handler = { request in
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 400, httpVersion: nil, headerFields: nil
            )!
            return (
                response,
                Data(#"{"error":"hosting-description-acknowledgement-required","message":"Please acknowledge."}"#.utf8)
            )
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let api = makeMobileAPI(store: InMemoryMobileCredentialStore())
        do {
            _ = try await api.sendMessage(
                serverURLString: "https://api.example.test",
                memberID: "member-1",
                content: "Hello"
            )
            XCTFail("Expected acknowledgement-required error")
        } catch {
            XCTAssertEqual(error as? TrustrootsAPIError, .hostingDescriptionAcknowledgementRequired)
        }
    }

    private var rotatedSessionJSON: String {
        #"{"accessToken":"rotated-access","refreshToken":"rotated-refresh","accessTokenExpiresAt":"2026-07-16T11:00:00Z","member":{"username":"traveller","displayName":"A Traveller","public":true}}"#
    }

    private func mobileResponse(_ request: URLRequest, status: Int, body: String = "{}") -> (HTTPURLResponse, Data) {
        (HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, Data(body.utf8))
    }

    private func makeMobileAPI(store: MobileCredentialStoring) -> TrustrootsAPI {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        return TrustrootsAPI(
            session: URLSession(configuration: configuration),
            credentialStore: store,
            notificationCenter: NotificationCenter()
        )
    }

    private static func body(of request: URLRequest) -> Data? {
        if let data = request.httpBody { return data }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            data.append(contentsOf: buffer.prefix(count))
        }
        return data
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

    func testMobileBrowserSignInRequiresTheExpectedCallbackAndState() throws {
        let attempt = try MobileBrowserSignIn(serverURLString: "https://api.example.test:8443")
        let start = try XCTUnwrap(URLComponents(url: attempt.startURL, resolvingAgainstBaseURL: false))
        let query = try XCTUnwrap(start.queryItems)
        XCTAssertEqual(start.scheme, "https")
        XCTAssertEqual(start.host, "api.example.test")
        XCTAssertEqual(start.port, 8443)
        XCTAssertEqual(start.path, "/auth/mobile/start")
        XCTAssertEqual(query.count, 3)
        XCTAssertEqual(query.first(where: { $0.name == "platform" })?.value, "ios")
        let expectedChallenge = Data(SHA256.hash(data: Data(attempt.codeVerifier.utf8))).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        XCTAssertEqual(attempt.codeVerifier.count, 43)
        XCTAssertEqual(query.first(where: { $0.name == "code_challenge" })?.value, expectedChallenge)
        let callback = try Self.browserCallback(from: attempt.startURL)
        XCTAssertEqual(try attempt.code(from: callback), String(repeating: "a", count: 43))

        let valid = callback.absoluteString
        for invalid in [
            valid.replacingOccurrences(of: "org.trustroots.mobile:", with: "https:"),
            valid.replacingOccurrences(of: "//auth/", with: "//other/"),
            valid.replacingOccurrences(of: "//auth/", with: "//auth:443/"),
            valid.replacingOccurrences(of: "//auth/", with: "//user@auth/"),
            valid.replacingOccurrences(of: "/complete", with: "/%63omplete"),
            valid.replacingOccurrences(of: "state=", with: "state=other-"),
            valid.replacingOccurrences(of: "code=", with: "code=+"),
            valid.replacingOccurrences(of: String(repeating: "a", count: 43), with: "short"),
            valid + "&state=duplicate",
            valid + "&accessToken=unexpected",
            valid + "#unexpected",
        ] {
            XCTAssertThrowsError(try attempt.code(from: XCTUnwrap(URL(string: invalid))), invalid)
        }
    }

    @MainActor
    func testBrowserSignInKeepsCredentialsOutOfStorageUntilExchangeCompletes() async throws {
        let defaults = UserDefaults.standard
        let persistedKeys = ["trustroots.signedInMember", "trustroots.apiServerURL", OfflineResponseCache.scopeDefaultsKey]
        let savedDefaults = persistedKeys.map { defaults.object(forKey: $0) }
        defer {
            for (key, value) in zip(persistedKeys, savedDefaults) { defaults.set(value, forKey: key) }
            MobileAPIURLProtocol.handler = nil
        }
        let credentials = InMemoryMobileCredentialStore()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration), credentialStore: credentials)
        let identity = NostrIdentityManager(keyStore: InMemoryNostrKeyStorage(), clearPermissions: {})
        let session = MemberSessionStore(
            api: api,
            serverURLString: "https://api.example.test:8443",
            credentialStore: credentials,
            nostrIdentity: identity
        )
        var exchangeCount = 0
        MobileAPIURLProtocol.handler = { request in
            let url = try XCTUnwrap(request.url)
            XCTAssertEqual(url.host, "api.example.test")
            XCTAssertEqual(url.port, 8443)
            XCTAssertEqual(request.httpMethod, "POST")
            if url.path == "/api/mobile/v0/auth/signin" {
                let response = try XCTUnwrap(HTTPURLResponse(url: url, statusCode: 403, httpVersion: nil, headerFields: nil))
                return (response, Data(#"{"code":"web_sign_in_required","message":"Complete sign-in on the website.","mfaRequired":true}"#.utf8))
            }
            XCTAssertEqual(url.path, "/api/mobile/v0/auth/browser/exchange")
            let body = try XCTUnwrap(Self.body(of: request))
            let fields = try JSONDecoder().decode([String: String].self, from: body)
            XCTAssertEqual(fields.count, 3)
            XCTAssertEqual(fields["code"], String(repeating: "a", count: 43))
            XCTAssertEqual(fields["codeVerifier"]?.count, 43)
            XCTAssertEqual(fields["platform"], "ios")
            XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
            exchangeCount += 1
            let response = try XCTUnwrap(HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil))
            let data = exchangeCount == 1
                ? Data(#"{"accessToken":"incomplete"}"#.utf8)
                : Data(#"{"accessToken":"browser-access","refreshToken":"browser-refresh","accessTokenExpiresAt":"2026-11-27T12:00:00Z","member":{"username":"mira","displayName":"Mira Example","public":true}}"#.utf8)
            return (response, data)
        }

        await session.signIn(usernameOrEmail: "mira", password: "example-password")
        XCTAssertTrue(session.requiresBrowserSignIn)
        XCTAssertEqual(session.errorMessage, "Complete sign-in on the website.")
        XCTAssertNil(credentials.load())
        await session.signInUsingBrowser { _ in throw CancellationError() }
        XCTAssertTrue(session.requiresBrowserSignIn)
        XCTAssertNil(session.browserSignInError)
        XCTAssertFalse(session.isSigningIn)
        XCTAssertNil(credentials.load())
        XCTAssertEqual(exchangeCount, 0)

        await session.signInUsingBrowser { start in
            session.serverURLString = "https://other.example.test"
            return try Self.browserCallback(from: start)
        }
        XCTAssertFalse(session.requiresBrowserSignIn)
        XCTAssertNil(credentials.load())
        XCTAssertEqual(exchangeCount, 0)

        session.serverURLString = "https://api.example.test:8443"
        await session.signIn(usernameOrEmail: "mira", password: "example-password")
        await session.signInUsingBrowser { try Self.browserCallback(from: $0) }
        XCTAssertTrue(session.requiresBrowserSignIn)
        XCTAssertNotNil(session.browserSignInError)
        XCTAssertNil(session.member)
        XCTAssertNil(credentials.load())

        await session.signInUsingBrowser { try Self.browserCallback(from: $0) }
        XCTAssertFalse(session.requiresBrowserSignIn)
        XCTAssertNil(session.browserSignInError)
        XCTAssertEqual(session.member?.username, "mira")
        XCTAssertEqual(credentials.load(), MobileCredentials(accessToken: "browser-access", refreshToken: "browser-refresh"))
        XCTAssertEqual(exchangeCount, 2)
    }

    private static func browserCallback(from start: URL) throws -> URL {
        let components = try XCTUnwrap(URLComponents(url: start, resolvingAgainstBaseURL: false))
        let state = try XCTUnwrap(components.queryItems?.first(where: { $0.name == "state" })?.value)
        let code = String(repeating: "a", count: 43)
        return try XCTUnwrap(URL(string: "org.trustroots.mobile://auth/complete?code=\(code)&state=\(state)"))
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

    func testSignInSolvesChallengeAndRetriesCredentialsOnce() async throws {
        var requestBodies: [[String: Any]] = []
        MobileAPIURLProtocol.handler = { request in
            let requestBody = Self.body(of: request) ?? Data()
            requestBodies.append(
                (try? JSONSerialization.jsonObject(with: requestBody) as? [String: Any]) ?? [:]
            )
            let attempt = requestBodies.count
            let status = attempt == 1 ? 429 : 200
            let response = HTTPURLResponse(
                url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil
            )!
            let body = attempt == 1
                ? Data(#"{"signinChallenge":{"token":"fictional-challenge","difficulty":14}}"#.utf8)
                : Data(#"{"accessToken":"test-access","refreshToken":"test-refresh","accessTokenExpiresAt":"2026-07-16T11:00:00Z","member":{"username":"quiet-fox","displayName":"Quiet Fox","public":true}}"#.utf8)
            return (response, body)
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration))
        let result = try await api.signIn(
            serverURLString: "https://api.example.test",
            usernameOrEmail: "quiet-fox",
            password: "fictional-password"
        )

        XCTAssertEqual(requestBodies.count, 2)
        XCTAssertNil(requestBodies[0]["signinProof"])
        let proof = try XCTUnwrap(requestBodies[1]["signinProof"] as? [String: Any])
        XCTAssertEqual(proof["token"] as? String, "fictional-challenge")
        let solution = try XCTUnwrap(proof["solution"] as? Int)
        let digest = Array(SHA256.hash(data: Data("fictional-challenge:\(solution)".utf8)))
        XCTAssertEqual(digest[0], 0)
        XCTAssertEqual(digest[1] & 0xfc, 0)
        XCTAssertEqual(result.credentials, MobileCredentials(accessToken: "test-access", refreshToken: "test-refresh"))
    }

    func testSignInDoesNotReturnPreAuthSessionWhenProofRetryNeedsMFA() async throws {
        var requestBodies: [[String: Any]] = []
        MobileAPIURLProtocol.handler = { request in
            requestBodies.append(
                (try? JSONSerialization.jsonObject(with: Self.body(of: request) ?? Data()) as? [String: Any]) ?? [:]
            )
            let isProofRetry = requestBodies.count == 2
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: isProofRetry ? 202 : 429,
                httpVersion: nil,
                headerFields: isProofRetry
                    ? ["Set-Cookie": "connect.sid=pre-auth-session; Path=/; HttpOnly"]
                    : nil
            )!
            let body = isProofRetry
                ? Data(#"{"username":"quiet-fox","displayName":"Quiet Fox","public":true,"mfaRequired":true,"challenge":"pre-auth-challenge"}"#.utf8)
                : Data(#"{"signinChallenge":{"token":"fictional-challenge","difficulty":14}}"#.utf8)
            return (response, body)
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration))
        var returnedSession = false

        do {
            _ = try await api.signIn(
                serverURLString: "https://api.example.test",
                usernameOrEmail: "quiet-fox",
                password: "fictional-password"
            )
            returnedSession = true
        } catch let error as TrustrootsAPIError {
            XCTAssertEqual(
                error,
                .serverMessage(
                    "Sign-in is incomplete. Start again to continue in your browser."
                )
            )
        } catch {
            XCTFail("Unexpected sign-in error: \(error)")
        }

        XCTAssertFalse(returnedSession, "MFA proof retry must not return a SessionResponse")
        XCTAssertEqual(requestBodies.count, 2)
        XCTAssertNotNil(requestBodies.last?["signinProof"])
    }

    func testSignInRejectsMFARequiredMarkerOnSuccessfulHTTPStatus() async throws {
        MobileAPIURLProtocol.handler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Set-Cookie": "connect.sid=pre-auth-session; Path=/; HttpOnly"]
            )!
            return (
                response,
                Data(#"{"username":"quiet-fox","displayName":"Quiet Fox","public":true,"mfaRequired":true,"challenge":"pre-auth-challenge"}"#.utf8)
            )
        }
        defer { MobileAPIURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MobileAPIURLProtocol.self]
        let api = TrustrootsAPI(session: URLSession(configuration: configuration))

        do {
            _ = try await api.signIn(
                serverURLString: "https://api.example.test",
                usernameOrEmail: "quiet-fox",
                password: "fictional-password"
            )
            XCTFail("An MFA marker must not produce a SessionResponse")
        } catch let error as TrustrootsAPIError {
            XCTAssertEqual(
                error,
                .serverMessage(
                    "Sign-in is incomplete. Start again to continue in your browser."
                )
            )
        }
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

    func testPilotDraftPersistsOnlyForItsServerAccountAndRecipient() throws {
        let directory = URL.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = PilotMessageDraftStore(directory: directory)
        let key = PilotMessageDraftStore.Key(server: "https://example.test", username: "Example-Member", recipientID: "partner-1")
        let draft = "  An unsent reply.\nNext line."
        try store.save(draft, for: key)
        XCTAssertEqual(try directory.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup, true)

        let reopened = PilotMessageDraftStore(directory: directory)
        XCTAssertEqual(reopened.load(.init(server: key.server, username: "example-member", recipientID: key.recipientID)), draft)
        XCTAssertEqual(reopened.load(.init(server: "https://other.example.test", username: key.username, recipientID: key.recipientID)), "")
        XCTAssertEqual(reopened.load(.init(server: key.server, username: "other-member", recipientID: key.recipientID)), "")
        XCTAssertEqual(reopened.load(.init(server: key.server, username: key.username, recipientID: "partner-2")), "")

        try reopened.save(" \n", for: key)
        XCTAssertEqual(store.load(key), "")
        XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: directory.path).isEmpty)
        XCTAssertNoThrow(try reopened.save("", for: key))
    }
}

private final class MobileAPIURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

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
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
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

private enum NostrTestKeys {
    static let first = String(repeating: "0", count: 63) + "1"
    static let second = String(repeating: "0", count: 63) + "2"
    static let firstNsec = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl"
    static let firstNpub = "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d"
}

private enum NostrTestFailure: Error {
    case storage
    case denied
}

private final class InMemoryNostrKeyStorage: NostrKeyStorage {
    var values: [String: String] = [:]
    var mutations: [String] = []
    var failRead = false
    var failSave = false
    var failScopedSave = false
    var failRemove = false

    func read(account: String) throws -> String? {
        if failRead { throw NostrTestFailure.storage }
        return values[account]
    }

    func save(secret: String, account: String) throws {
        if failSave || (failScopedSave && account.hasPrefix("nostr-v1:")) { throw NostrTestFailure.storage }
        guard values[account] == nil else { throw NostrIdentityError.existingKey }
        mutations.append("save:\(account)")
        values[account] = secret
    }

    func remove(account: String) throws {
        if failRemove { throw NostrTestFailure.storage }
        mutations.append("remove:\(account)")
        values.removeValue(forKey: account)
    }
}
