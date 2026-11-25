import Foundation
import XCTest

final class SharedMemberPilotJourneyUITests: XCTestCase {
    func testRegularLaunchUsesSharedSignInAndRestoresSession() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in
            signOutOfNativeAccountIfNeeded(app)
        }
        signOutOfNativeAccountIfNeeded(app)

        let username = app.descendants(matching: .any)["pilot-username"]
        XCTAssertTrue(username.waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts["API: 127.0.0.1"].exists)
        XCTAssertTrue(app.staticTexts["sign-in-ios-build"].exists)
        let password = app.descendants(matching: .any)["pilot-password"]
        let logo = app.descendants(matching: .any)["sign-in-logo"]
        XCTAssertTrue(logo.exists)
        XCTAssertGreaterThan(logo.frame.minY, password.frame.maxY)
        XCTAssertFalse(app.buttons["Exit shared pilot"].exists)
        app.buttons["Join"].tap()
        XCTAssertTrue(app.staticTexts["Join Trustroots"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()
        XCTAssertTrue(username.waitForExistence(timeout: 10))

        signInToRegularApp(app)
        let homeTab = app.buttons["Home"]
        XCTAssertTrue(homeTab.isSelected)
        XCTAssertFalse(app.buttons["Trustroots home"].exists)
        XCTAssertTrue(element(labelled: "A fictional Trustroots update.", in: app).waitForExistence(timeout: 10))
        let homeHeadings = app.staticTexts.matching(identifier: "Home").allElementsBoundByIndex
        XCTAssertFalse(homeHeadings.contains { $0.frame.midY < homeTab.frame.minY })
        let home = XCTAttachment(screenshot: app.screenshot())
        home.name = "regular-ios-home"
        home.lifetime = .keepAlways
        add(home)
        XCTAssertTrue(app.buttons["Search"].exists)
        XCTAssertTrue(app.buttons["Messages"].exists)
        app.buttons["Menu"].tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["circles-menu-entry"].waitForExistence(timeout: 10),
            app.debugDescription
        )
        let profile = app.descendants(matching: .any)["profile-menu-entry"]
        XCTAssertTrue(profile.waitForExistence(timeout: 10), app.debugDescription)
        profile.tap()
        XCTAssertTrue(app.buttons["Edit profile"].waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Menu"].tap()
        let faq = app.descendants(matching: .any)["faq-menu-entry"]
        XCTAssertTrue(faq.waitForExistence(timeout: 10), app.debugDescription)
        faq.tap()
        XCTAssertTrue(app.buttons["Back"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["circles-menu-entry"].waitForExistence(timeout: 10))
        let contacts = app.descendants(matching: .any)["contacts-menu-entry"]
        XCTAssertTrue(contacts.waitForExistence(timeout: 10), app.debugDescription)
        contacts.tap()
        let contact = app.descendants(matching: .any)["contact-contact-pilot-one"]
        XCTAssertTrue(contact.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(
            contact.label.contains("Awaiting confirmation") || app.staticTexts["Awaiting confirmation"].exists,
            app.debugDescription
        )
        contact.tap()
        XCTAssertTrue(app.staticTexts["A partner profile"].waitForExistence(timeout: 15), app.debugDescription)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Menu"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Home"].isSelected)
        XCTAssertFalse(app.buttons["Sign in"].exists)
    }

    func testRegularProfileShowsMeetingAvailabilityWhenNotHosting() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in
            signOutOfNativeAccountIfNeeded(app)
        }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        app.buttons["Menu"].tap()
        let profile = element(labelled: "My profile", in: app)
        XCTAssertTrue(profile.waitForExistence(timeout: 10))
        profile.tap()

        XCTAssertTrue(element(labelled: "Maybe up for meeting", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element(labelled: "Not hosting currently", in: app).exists)
        XCTAssertFalse(element(labelled: "Offers volunteering", in: app).exists)
    }

    @MainActor
    func testEditingMeetingAndVolunteeringPreservesWebHostingOffer() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let fixtureURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)"))
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", fixtureURL.absoluteString]
        app.launch()
        addTeardownBlock { [self] in
            app.terminate()
            app.launch()
            signOutOfNativeAccountIfNeeded(app)
        }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)
        try await updateFixtureSession("prepare-hosting-offer", at: fixtureURL)

        app.buttons["Menu"].tap()
        app.buttons["My profile"].tap()
        let edit = app.buttons["edit-hosting-offer"]
        XCTAssertTrue(edit.waitForExistence(timeout: 15), app.debugDescription)
        edit.tap()

        let settings = app.descendants(matching: .any)["hosting-availability-settings"]
        let hostingYes = app.descendants(matching: .any)["hosting-availability-yes"]
        let hostingNo = app.descendants(matching: .any)["hosting-availability-no"]
        let increaseGuests = app.descendants(matching: .any)["hosting-guests-increase"]
        XCTAssertTrue(settings.waitForExistence(timeout: 15), app.debugDescription)
        let settingsReady = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isHittable == true"),
            object: hostingYes
        )
        await fulfillment(of: [settingsReady], timeout: 10)
        XCTAssertFalse(increaseGuests.exists, app.debugDescription)
        hostingYes.tap()
        XCTAssertTrue(increaseGuests.waitForExistence(timeout: 10), app.debugDescription)
        reveal(increaseGuests, in: app)
        increaseGuests.tap()
        XCTAssertTrue(element(labelled: "Maximum guests: 1", in: app).waitForExistence(timeout: 10))
        app.descendants(matching: .any)["hosting-guests-decrease"].tap()
        XCTAssertTrue(element(labelled: "Maximum guests: 0", in: app).waitForExistence(timeout: 10))
        let capture = XCTAttachment(screenshot: settings.screenshot())
        capture.name = "regular-ios-hosting-availability"
        capture.lifetime = .keepAlways
        add(capture)

        for _ in 0..<3 where !hostingNo.isHittable { app.swipeDown() }
        hostingNo.tap()
        let meetingMaybe = app.descendants(matching: .any)["meeting-availability-maybe"]
        reveal(meetingMaybe, in: app)
        meetingMaybe.tap()
        let circlesOnly = app.descendants(matching: .any)["hosting-circles-only"]
        reveal(circlesOnly, in: app)
        circlesOnly.tap()

        let volunteering = app.descendants(matching: .any)["hosting-volunteering"]
        XCTAssertTrue(volunteering.waitForExistence(timeout: 10), app.debugDescription)
        reveal(volunteering, in: app)
        volunteering.tap()

        let save = app.buttons["save-hosting-offer"]
        XCTAssertTrue(save.isEnabled)
        save.tap()
        let saved = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isEnabled == false AND label == %@", "Save"),
            object: save
        )
        await fulfillment(of: [saved], timeout: 10)

        let (data, response) = try await URLSession.shared.data(from: fixtureURL.appendingPathComponent("fixture/hosting-offer"))
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let offer = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(offer["status"] as? String, "no")
        XCTAssertEqual(offer["meetingStatus"] as? String, "maybe")
        XCTAssertEqual(offer["volunteering"] as? Bool, false)
        XCTAssertEqual(offer["maxGuests"] as? Int, 0)
        XCTAssertEqual(offer["showOnlyInMyCircles"] as? Bool, false)
        XCTAssertEqual(offer["location"] as? [Double], [41.1, -8.5])
        XCTAssertEqual(offer["description"] as? String, "<p>Fictional offer details.</p>")
        XCTAssertEqual(offer["noOfferDescription"] as? String, "<p>Travelling this month.</p>")

        let reason = app.descendants(matching: .any)["hosting-unavailable-reason"]
        XCTAssertTrue(reason.waitForExistence(timeout: 10), app.debugDescription)
        reveal(reason, in: app)
        XCTAssertEqual(reason.value as? String, "Travelling this month.")
        let details = app.descendants(matching: .any)["hosting-details-settings"]
        XCTAssertTrue(details.exists, app.debugDescription)
        let detailsCapture = XCTAttachment(screenshot: details.screenshot())
        detailsCapture.name = "regular-ios-hosting-details"
        detailsCapture.lifetime = .keepAlways
        add(detailsCapture)

        // The area beyond the first line places the insertion point after the saved reason.
        reason.coordinate(withNormalizedOffset: CGVector(dx: 0.86, dy: 0.75)).tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), app.debugDescription)
        let additionalLine = "\nBack next week."
        app.typeText(additionalLine)
        let updatedReason = "Travelling this month." + additionalLine
        let edited = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", updatedReason),
            object: reason
        )
        await fulfillment(of: [edited], timeout: 10)
        XCTAssertTrue(save.isEnabled)
        save.tap()
        let savedDetails = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isEnabled == false AND label == %@", "Save"),
            object: save
        )
        await fulfillment(of: [savedDetails], timeout: 10)

        let (editedData, editedResponse) = try await URLSession.shared.data(
            from: fixtureURL.appendingPathComponent("fixture/hosting-offer")
        )
        XCTAssertEqual((editedResponse as? HTTPURLResponse)?.statusCode, 200)
        let editedOffer = try XCTUnwrap(JSONSerialization.jsonObject(with: editedData) as? [String: Any])
        XCTAssertEqual(editedOffer["noOfferDescription"] as? String, updatedReason)
        XCTAssertEqual(editedOffer["description"] as? String, "<p>Fictional offer details.</p>")
        XCTAssertEqual(editedOffer["location"] as? [Double], [41.1, -8.5])
    }

    @MainActor
    func testRegularCirclesFiltersOpensDetailsAndChangesMembership() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)
        app.buttons["Menu"].tap()
        let circles = app.descendants(matching: .any)["circles-menu-entry"]
        XCTAssertTrue(circles.waitForExistence(timeout: 10), app.debugDescription)
        circles.tap()

        let joined = app.descendants(matching: .any)["circle-circle-pilot-garden"]
        let discovery = app.descendants(matching: .any)["circle-circle-pilot-night"]
        XCTAssertTrue(joined.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(discovery.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertLessThan(joined.frame.minY, discovery.frame.minY)

        let filter = app.descendants(matching: .any)["circles-filter"]
        enterText("lanternx", into: filter, in: app)
        XCTAssertTrue(element(labelled: "No matching circles", in: app).waitForExistence(timeout: 10))
        app.typeText(XCUIKeyboardKey.delete.rawValue)
        XCTAssertTrue(discovery.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(joined.exists)

        let membership = app.descendants(matching: .any)["circle-membership-circle-pilot-night"]
        XCTAssertEqual(membership.label, "Join")
        membership.tap()
        let becameJoined = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label == %@", "Joined"), object: membership
        )
        await fulfillment(of: [becameJoined], timeout: 10)

        discovery.tap()
        XCTAssertTrue(app.staticTexts["Night Walkers"].waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Back"].tap()
        XCTAssertTrue(filter.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(filter.value as? String, "lantern")
        XCTAssertTrue(discovery.exists)
        XCTAssertFalse(joined.exists)
        XCTAssertEqual(membership.label, "Joined")
        membership.tap()
        let becameAvailable = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label == %@", "Join"), object: membership
        )
        await fulfillment(of: [becameAvailable], timeout: 10)
        XCTAssertTrue(element(labelled: "Open the Trustroots Wiki", in: app).exists)
    }

    @MainActor
    func testRegularInboxFiltersMessageContentAndUpdatesUnreadOnReturn() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let fixtureURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)"))
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", fixtureURL.absoluteString]
        app.launch()
        addTeardownBlock { [self] in
            signOutOfNativeAccountIfNeeded(app)
        }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)
        app.buttons["Messages"].tap()

        let row = app.descendants(matching: .any)["message-thread-thread-pilot-1"]
        let unread = app.descendants(matching: .any)["unread-thread-pilot-1"]
        func showsUnread() -> Bool {
            unread.exists || row.label.contains("Unread") || (row.value as? String)?.contains("Unread") == true
        }
        XCTAssertTrue(row.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(showsUnread(), app.debugDescription)

        let filter = app.descendants(matching: .any)["inbox-filter"]
        enterText("lanternx", into: filter, in: app)
        XCTAssertTrue(element(labelled: "No matching conversations.", in: app).waitForExistence(timeout: 10))
        XCTAssertFalse(row.exists)
        // The matching word is in an older message, outside the inbox excerpt.
        app.typeText(XCUIKeyboardKey.delete.rawValue)
        XCTAssertTrue(row.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(showsUnread(), app.debugDescription)

        struct InboxReadState: Decodable { let read: Bool }
        let (data, response) = try await URLSession.shared.data(
            from: fixtureURL.appendingPathComponent("fixture/inbox-read-state")
        )
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        XCTAssertFalse(try JSONDecoder().decode(InboxReadState.self, from: data).read)

        row.tap()
        XCTAssertTrue(app.staticTexts["Hello from the test fixture."].waitForExistence(timeout: 15))
        app.navigationBars.buttons["Back"].tap()
        XCTAssertTrue(filter.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertEqual(filter.value as? String, "lantern")
        let readAfterReturn = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in row.exists && !showsUnread() },
            object: row
        )
        await fulfillment(of: [readAfterReturn], timeout: 15)
    }

    @MainActor
    func testMemberJourneyRetainsFailedReplyAndUsesSavedSession() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let fixtureURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)"))
        let app = XCUIApplication()
        app.launchArguments = [
            "--shared-member-pilot",
            "-trustroots.apiServerURL",
            fixtureURL.absoluteString,
        ]

        app.launch()
        addTeardownBlock { [self] in
            signOutIfAlreadySignedIn(app)
        }
        signOutIfAlreadySignedIn(app)
        XCTAssertTrue(element(labelled: "Trustroots", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element(labelled: "Travellers’ community", in: app).exists)
        let signInScreen = XCTAttachment(screenshot: app.screenshot())
        signInScreen.name = "shared-member-sign-in"
        signInScreen.lifetime = .keepAlways
        add(signInScreen)
        signIn(app)

        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(element(labelled: "A fictional Trustroots update.", in: app).waitForExistence(timeout: 10))
        let home = XCTAttachment(screenshot: app.screenshot())
        home.name = "shared-member-dashboard"
        home.lifetime = .keepAlways
        add(home)
        element(labelled: "My profile", in: app).tap()
        let profile = element(labelled: "Mira Example", in: app)
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Back"].tap()
        app.buttons["Exit shared pilot"].tap()
        XCTAssertTrue(app.buttons["Menu"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Home"].isSelected)
        XCTAssertTrue(app.buttons["Search"].exists)
        XCTAssertTrue(app.buttons["Messages"].exists)
        XCTAssertTrue(element(labelled: "A fictional Trustroots update.", in: app).waitForExistence(timeout: 10))
        let nativeHome = XCTAttachment(screenshot: app.screenshot())
        nativeHome.name = "shared-home-regular-shell"
        nativeHome.lifetime = .keepAlways
        add(nativeHome)
        app.buttons["Menu"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["circles-menu-entry"].waitForExistence(timeout: 10))

        app.terminate()
        try await updateFixtureSession("expire-access-token", at: fixtureURL)
        app.launch()
        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 10))
        element(labelled: "My profile", in: app).tap()
        XCTAssertTrue(
            element(labelled: "A test profile after refresh 1", in: app).waitForExistence(timeout: 15),
            "The saved session should refresh and load the profile after relaunch.\n\(app.debugDescription)"
        )
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()
        element(labelled: "Messages", in: app).tap()
        XCTAssertTrue(app.staticTexts["Robin Example"].waitForExistence(timeout: 10))
        app.buttons["View profile"].tap()
        XCTAssertTrue(app.staticTexts["A partner profile"].waitForExistence(timeout: 10))
        app.buttons["Send a message"].tap()
        XCTAssertTrue(app.staticTexts["Hello from the test fixture."].waitForExistence(timeout: 10))

        let draft = app.descendants(matching: .any)["pilot-draft"]
        enterText("A reply kept after a delivery failure.", into: draft, in: app)
        app.buttons["Send reply"].tap()

        XCTAssertTrue(element(labelled: "Temporary fixture delivery failure.", in: app).waitForExistence(timeout: 10))
        XCTAssertEqual(draft.value as? String, "A reply kept after a delivery failure.")

        app.terminate()
        app.launch()
        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 10))
        element(labelled: "Messages", in: app).tap()
        let restoredDraft = openConversation(in: app)
        XCTAssertTrue(app.staticTexts["Hello from the test fixture."].waitForExistence(timeout: 15))
        XCTAssertEqual(restoredDraft.value as? String, "A reply kept after a delivery failure.")
        XCTAssertTrue(app.buttons["Send reply"].isEnabled)
        app.buttons["Send reply"].tap()
        XCTAssertTrue(app.staticTexts["A reply kept after a delivery failure."].waitForExistence(timeout: 10))

        app.terminate()
        // The fixture rejects the original refresh token after the first rotation.
        try await updateFixtureSession("expire-access-token", at: fixtureURL)
        app.launch()
        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 10))
        element(labelled: "My profile", in: app).tap()
        XCTAssertTrue(
            element(labelled: "A test profile after refresh 2", in: app).waitForExistence(timeout: 15),
            "The rotated refresh token should survive relaunch.\n\(app.debugDescription)"
        )
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()
        element(labelled: "Messages", in: app).tap()
        let clearedDraft = openConversation(in: app)
        XCTAssertTrue(app.staticTexts["A reply kept after a delivery failure."].waitForExistence(timeout: 10))
        XCTAssertTrue(clearedDraft.exists)
        XCTAssertFalse(app.buttons["Send reply"].isEnabled)

        app.buttons["Back"].tap()
        app.buttons["Back"].tap()
        element(labelled: "My profile", in: app).tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))

        signIn(app)
        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 10))
        element(labelled: "My profile", in: app).tap()
        let reopenedProfile = element(labelled: "Mira Example", in: app)
        XCTAssertTrue(reopenedProfile.waitForExistence(timeout: 30), app.debugDescription)
        app.buttons["Back"].tap()
        try await updateFixtureSession("revoke-session", at: fixtureURL)
        element(labelled: "Messages", in: app).tap()

        let sessionExpired = element(
            labelled: "Your session expired or is no longer valid. Please sign in again.",
            in: app
        )
        XCTAssertTrue(sessionExpired.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.buttons["Sign in"].exists)
        XCTAssertFalse(element(labelled: "Messages", in: app).exists)

        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(app.buttons["Sign out"].exists)
    }

    private func updateFixtureSession(_ action: String, at fixtureURL: URL) async throws {
        var request = URLRequest(
            url: fixtureURL.appendingPathComponent("fixture/\(action)"),
            timeoutInterval: 5
        )
        request.httpMethod = "POST"
        let (_, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual(
            (response as? HTTPURLResponse)?.statusCode,
            200,
            "Fixture action \(action) requires an active session."
        )
    }

    func testNostrLocalKeySurvivesSignOutAndRemovalKeepsProfileSeparate() throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = [
            "-trustroots.apiServerURL", "http://127.0.0.1:\(port)",
        ]
        app.launch()
        addTeardownBlock { [self] in
            signOutOfNativeAccountIfNeeded(app)
        }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)
        openNostrAccount(app)

        // Simulator Keychain survives reinstall/relaunch. Start with this fixture's
        // key removed so the journey is repeatable without touching profile links.
        if app.buttons["Remove local key"].exists {
            tapAccountButton(app.buttons["Remove local key"], in: app)
            app.alerts.buttons["Remove"].tap()
        }
        let generate = app.buttons["Generate new key"]
        tapAccountButton(generate, in: app)
        let localKey = app.staticTexts["nostr-local-public-key"]
        XCTAssertTrue(localKey.waitForExistence(timeout: 10))
        let publicKey = localKey.label
        XCTAssertTrue(publicKey.hasPrefix("npub1"))
        XCTAssertTrue(app.staticTexts["No linked public key."].exists)
        let link = app.buttons["Link local key to profile"]
        tapAccountButton(link, in: app)
        let unlink = app.buttons["Unlink profile key"]
        XCTAssertTrue(unlink.waitForExistence(timeout: 10))
        attachNostrSection(app, name: "Local Nostr key and linked profile key")

        let signOut = app.buttons["Sign out"]
        tapAccountButton(signOut, in: app)
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
        app.terminate()
        app.launch()
        signInToRegularApp(app)
        openNostrAccount(app)
        XCTAssertTrue(localKey.waitForExistence(timeout: 10))
        XCTAssertEqual(localKey.label, publicKey)

        let remove = app.buttons["Remove local key"]
        tapAccountButton(remove, in: app)
        XCTAssertTrue(app.alerts["Remove local Nostr key?"].waitForExistence(timeout: 5))
        app.alerts.buttons["Cancel"].tap()
        XCTAssertTrue(localKey.exists)
        tapAccountButton(remove, in: app)
        app.alerts.buttons["Remove"].tap()
        XCTAssertTrue(generate.waitForExistence(timeout: 10))
        XCTAssertFalse(localKey.exists)
        XCTAssertTrue(unlink.exists)
        attachNostrSection(app, name: "Local key removed without changing profile")
        tapAccountButton(unlink, in: app)
        XCTAssertTrue(app.alerts["Unlink profile key?"].waitForExistence(timeout: 5))
        app.alerts.buttons["Unlink"].tap()
        XCTAssertTrue(app.staticTexts["No linked public key."].waitForExistence(timeout: 10))
        tapAccountButton(signOut, in: app)
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
    }

    private func openNostrAccount(_ app: XCUIApplication) {
        let menu = app.buttons["Menu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15), app.debugDescription)
        menu.tap()
        let account = app.descendants(matching: .any)["account-menu-entry"]
        XCTAssertTrue(account.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(account.isHittable, app.debugDescription)
        account.tap()
        let keySection = app.staticTexts["Local public key (npub)"]
        if !keySection.waitForExistence(timeout: 3), account.isHittable {
            account.tap()
        }
        XCTAssertTrue(keySection.waitForExistence(timeout: 10), app.debugDescription)
    }

    private func signOutOfNativeAccountIfNeeded(_ app: XCUIApplication) {
        guard app.buttons["Menu"].waitForExistence(timeout: 2) else { return }
        if !app.staticTexts["Local public key (npub)"].exists {
            openNostrAccount(app)
        }
        tapAccountButton(app.buttons["Sign out"], in: app)
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10), app.debugDescription)
    }

    private func tapAccountButton(_ button: XCUIElement, in app: XCUIApplication) {
        XCTAssertTrue(button.waitForExistence(timeout: 10), app.debugDescription)
        let account = app.scrollViews["account-scroll-view"]
        XCTAssertTrue(account.exists, app.debugDescription)
        // Account starts near the top. Later actions can leave the next button
        // above or below the viewport, depending on how the key section shrank.
        for _ in 0..<5 {
            if button.isHittable { break }
            let belowCenter = button.frame.midY >= account.frame.midY
            let start = account.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: belowCenter ? 0.7 : 0.3))
            let end = account.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: belowCenter ? 0.3 : 0.7))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        XCTAssertTrue(button.isHittable, app.debugDescription)
        XCTAssertTrue(button.isEnabled, app.debugDescription)
        button.tap()
    }

    private func attachNostrSection(_ app: XCUIApplication, name: String) {
        let section = app.descendants(matching: .any)["nostr-key-section"]
        XCTAssertTrue(section.exists)
        let screenshot = XCTAttachment(screenshot: section.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    private func element(labelled label: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func openConversation(in app: XCUIApplication) -> XCUIElement {
        // Resolve the draft against the process launched for this visit.
        let draft = app.descendants(matching: .any)["pilot-draft"]
        let open = app.buttons["Open conversation"]
        XCTAssertTrue(open.waitForExistence(timeout: 30), app.debugDescription)
        reveal(open, in: app)
        open.tap()
        if !draft.waitForExistence(timeout: 3), open.isHittable {
            open.tap()
        }
        XCTAssertTrue(draft.waitForExistence(timeout: 15), app.debugDescription)
        return draft
    }

    private func signIn(_ app: XCUIApplication) {
        let username = app.descendants(matching: .any)["pilot-username"]
        let password = app.descendants(matching: .any)["pilot-password"]
        signIn(app, username: username, password: password)
    }

    private func signInToRegularApp(_ app: XCUIApplication) {
        signIn(app)
        XCTAssertTrue(app.buttons["Menu"].waitForExistence(timeout: 15), app.debugDescription)
        let passwordPrompt = app.sheets["Save Password?"]
        if passwordPrompt.waitForExistence(timeout: 5) {
            let dismiss = passwordPrompt.buttons["Not Now"]
            let center = dismiss.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            center.tap()
            if !passwordPrompt.waitForNonExistence(timeout: 2) {
                center.tap()
            }
            XCTAssertTrue(passwordPrompt.waitForNonExistence(timeout: 5), app.debugDescription)
        }
    }

    private func signIn(_ app: XCUIApplication, username: XCUIElement, password: XCUIElement) {
        enterText("pilot-member", into: username, in: app)
        enterText("example-password", into: password, in: app, secure: true)
        let submit = app.buttons["Sign in"]
        let credentialsEntered = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isEnabled == true"),
            object: submit
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [credentialsEntered], timeout: 10),
            .completed,
            "Sign in should be enabled after receiving both credentials."
        )
        reveal(submit, in: app)
        submit.tap()
    }

    private func enterText(_ text: String, into field: XCUIElement, in app: XCUIApplication, secure: Bool = false) {
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        reveal(field, in: app)
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isHittable == true AND isEnabled == true"),
            object: field
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [ready], timeout: 10),
            .completed,
            "The input should be visible and enabled.\n\(app.debugDescription)"
        )
        // Compose exposes the full field as a text view. Focus its leading text area.
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        if field.elementType == .textView {
            let keyboard = app.keyboards.firstMatch
            if !keyboard.waitForExistence(timeout: 2) {
                field.tap()
            }
            XCTAssertTrue(keyboard.waitForExistence(timeout: 5), app.debugDescription)
            // The focused UIKit input is outside the Compose accessibility element.
            app.typeText(text)
        } else {
            field.typeText(text)
        }
        let entered = XCTNSPredicateExpectation(
            predicate: NSPredicate { object, _ in
                guard let element = object as? XCUIElement,
                      let value = element.value as? String else { return false }
                return secure ? value.count == text.count : value == text
            },
            object: field
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [entered], timeout: 30),
            .completed,
            "The input should receive its complete value before continuing.\n\(field.debugDescription)"
        )
    }

    private func reveal(_ field: XCUIElement, in app: XCUIApplication) {
        let form = app.scrollViews.containing(.any, identifier: field.identifier).firstMatch
        for _ in 0..<3 {
            if field.isHittable { return }
            let frame = (form.exists ? form.frame : app.frame).intersection(app.frame)
            let keyboard = app.keyboards.firstMatch
            let bottom = keyboard.exists ? min(frame.maxY, keyboard.frame.minY) : frame.maxY
            let visibleHeight = bottom - frame.minY
            guard visibleHeight > 40 else { return }
            // Compose's form scrolls inside the keyboard-reduced viewport. Keep
            // the gesture above the keyboard so it scrolls the form, not the keys.
            let origin = app.coordinate(withNormalizedOffset: .zero)
            let x = frame.midX - app.frame.minX
            let start = origin.withOffset(CGVector(
                dx: x,
                dy: frame.minY - app.frame.minY + visibleHeight * 0.85
            ))
            let end = origin.withOffset(CGVector(
                dx: x,
                dy: frame.minY - app.frame.minY + visibleHeight * 0.25
            ))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
    }

    private func signOutIfAlreadySignedIn(_ app: XCUIApplication) {
        if element(labelled: "My profile", in: app).waitForExistence(timeout: 2) {
            element(labelled: "My profile", in: app).tap()
        }
        let signOut = app.buttons["Sign out"]
        guard signOut.waitForExistence(timeout: 2) else { return }
        reveal(signOut, in: app)
        signOut.tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
    }

    @MainActor
    func testShowsSavedProfileAndClearsOfflineBannerAfterLiveRequest() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let fixtureURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)"))
        let app = XCUIApplication()
        app.launchArguments = [
            "--shared-member-pilot",
            "-trustroots.apiServerURL",
            fixtureURL.absoluteString,
        ]
        app.launch()
        addTeardownBlock { [self] in signOutIfAlreadySignedIn(app) }
        addTeardownBlock { [self] in try await setDroppedProfileResponse(false, at: fixtureURL) }
        signOutIfAlreadySignedIn(app)
        signIn(app)

        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 15))
        element(labelled: "My profile", in: app).tap()
        let profile = element(labelled: "A test profile", in: app)
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        let banner = app.descendants(matching: .any)["offline-saved-data"].firstMatch
        XCTAssertFalse(banner.exists)

        try await setDroppedProfileResponse(true, at: fixtureURL)
        app.terminate()
        app.launch()
        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 15))
        element(labelled: "My profile", in: app).tap()
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(banner.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(banner.label.hasPrefix("Offline — saved "))
        let capture = XCTAttachment(data: app.screenshot().pngRepresentation, uniformTypeIdentifier: "public.png")
        capture.name = "Compose pilot showing a cached profile"
        capture.lifetime = .keepAlways
        add(capture)

        try await setDroppedProfileResponse(false, at: fixtureURL)
        element(labelled: "Messages", in: app).tap()
        XCTAssertTrue(app.staticTexts["Robin Example"].waitForExistence(timeout: 10), app.debugDescription)
        let bannerCleared = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: banner)
        XCTAssertEqual(XCTWaiter.wait(for: [bannerCleared], timeout: 10), .completed, app.debugDescription)
        app.buttons["Back"].tap()
    }

    @MainActor
    func testShowsMetricScaleOnNativeMap() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = [
            "-trustroots.apiServerURL",
            "http://127.0.0.1:\(port)",
            "-AppleLocale",
            "en_US",
        ]
        app.launch()
        addTeardownBlock { [self] in
            app.terminate()
            app.launch()
            signOutOfNativeAccountIfNeeded(app)
        }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        let search = app.buttons["Search"]
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()

        let scale = app.staticTexts["map-distance-scale"]
        XCTAssertTrue(scale.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(scale.label.hasSuffix(" km") || scale.label.hasSuffix(" m"), scale.label)

        let capture = XCTAttachment(screenshot: app.screenshot())
        capture.name = "iOS map distance scale"
        capture.lifetime = .keepAlways
        add(capture)

        let display = app.segmentedControls.firstMatch
        display.buttons["Results"].tap()
        let volunteer = app.buttons["search-result-offer-pilot-volunteer"]
        let other = app.buttons["search-result-offer-pilot-other"]
        XCTAssertTrue(volunteer.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(other.waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Search filters"].tap()
        let filterScreen = app.descendants(matching: .any)["compose-offer-search-filters"]
        XCTAssertTrue(filterScreen.waitForExistence(timeout: 10), app.debugDescription)
        let filtersCapture = XCTAttachment(screenshot: filterScreen.screenshot())
        filtersCapture.name = "iOS Compose offer search filters"
        filtersCapture.lifetime = .keepAlways
        add(filtersCapture)
        for id in ["offer-filter-hosts", "offer-filter-volunteering", "offer-filter-connections-only"] {
            let filter = app.descendants(matching: .any)[id]
            XCTAssertTrue(filter.waitForExistence(timeout: 5), app.debugDescription)
            reveal(filter, in: app)
            filter.tap()
        }
        app.buttons["Done"].tap()
        XCTAssertTrue(other.waitForNonExistence(timeout: 15), app.debugDescription)
        display.buttons["Map"].tap()
        XCTAssertTrue(scale.waitForExistence(timeout: 15), app.debugDescription)
        display.buttons["Results"].tap()
        XCTAssertTrue(volunteer.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertFalse(other.exists)
        volunteer.tap()
        XCTAssertTrue(app.buttons["Dismiss potential host"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Might meet"].firstMatch.exists)
        XCTAssertTrue(app.staticTexts["Offers volunteering"].firstMatch.exists)
        display.buttons["Map"].tap()
        let mapPin = app.buttons["View potential host"]
        XCTAssertTrue(mapPin.waitForExistence(timeout: 15), app.debugDescription)
        mapPin.tap()
        let openProfile = app.buttons["View Robin Example's profile"]
        XCTAssertTrue(openProfile.waitForExistence(timeout: 10), app.debugDescription)
        openProfile.tap()
        let profileBack = app.buttons["profile-header-back"]
        let profileIdentity = app.descendants(matching: .any)["profile-header-identity"]
        XCTAssertTrue(profileIdentity.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(profileBack.exists, app.debugDescription)
        // The profile uses an 84-point avatar centred vertically in its identity row.
        XCTAssertLessThanOrEqual(profileBack.frame.maxY + 42, profileIdentity.frame.midY)
        profileBack.tap()
        XCTAssertTrue(scale.waitForExistence(timeout: 10), app.debugDescription)

        app.buttons["Dismiss potential host"].tap()
        app.buttons["Search filters"].tap()
        app.buttons["Reset"].tap()
        app.buttons["Done"].tap()
        XCTAssertTrue(other.waitForExistence(timeout: 15), app.debugDescription)

        display.buttons["Members"].tap()
        app.buttons["Member filters"].tap()
        let connectedMembers = app.switches["My connections only"]
        XCTAssertTrue(connectedMembers.waitForExistence(timeout: 5))
        connectedMembers.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap()
        XCTAssertEqual(connectedMembers.value as? String, "1")
        app.buttons["Done"].tap()
        let query = app.textFields["member-search-field"]
        XCTAssertTrue(query.waitForExistence(timeout: 10), app.debugDescription)
        query.tap()
        query.typeText("partner profile")
        app.buttons["Search members"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["member-search-result-pilot-partner"].waitForExistence(timeout: 10), app.debugDescription)
        display.buttons["Map"].tap()
        XCTAssertTrue(scale.waitForExistence(timeout: 10), app.debugDescription)
    }

    private func setDroppedProfileResponse(_ drop: Bool, at fixtureURL: URL) async throws {
        var request = URLRequest(url: fixtureURL.appendingPathComponent("fixture/profile-connection"), timeoutInterval: 5)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["drop": drop])
        let (_, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    }
}
