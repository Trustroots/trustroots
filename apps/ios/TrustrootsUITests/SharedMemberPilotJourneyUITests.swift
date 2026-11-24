import Foundation
import XCTest

final class SharedMemberPilotJourneyUITests: XCTestCase {
    @MainActor
    func testMemberJourneyRetainsFailedReplyAndUsesSavedSession() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let fixtureURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)"))
        let app = XCUIApplication()
        app.launchArguments = [
            "--shared-member-pilot",
            "--shared-home",
            "-trustroots.apiServerURL",
            fixtureURL.absoluteString,
        ]

        app.launch()
        addTeardownBlock { [self] in
            signOutIfAlreadySignedIn(app)
        }
        signOutIfAlreadySignedIn(app)
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
        XCTAssertTrue(app.buttons["Circles"].waitForExistence(timeout: 10))

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
        openConversation(in: app, draft: draft)
        XCTAssertTrue(app.staticTexts["Hello from the test fixture."].waitForExistence(timeout: 15))
        XCTAssertEqual(draft.value as? String, "A reply kept after a delivery failure.")
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
        openConversation(in: app, draft: draft)
        XCTAssertTrue(app.staticTexts["A reply kept after a delivery failure."].waitForExistence(timeout: 10))
        XCTAssertTrue(draft.exists)
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
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
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
        signInNatively(app)
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
        signInNatively(app)
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
        let account = app.buttons["account-menu-entry"]
        XCTAssertTrue(account.waitForExistence(timeout: 10), app.debugDescription)
        account.tap()
        XCTAssertTrue(app.staticTexts["Local public key (npub)"].waitForExistence(timeout: 10), app.debugDescription)
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

    private func openConversation(in app: XCUIApplication, draft: XCUIElement) {
        let open = app.buttons["Open conversation"]
        XCTAssertTrue(open.waitForExistence(timeout: 10), app.debugDescription)
        reveal(open, in: app)
        open.tap()
        if !draft.waitForExistence(timeout: 3), open.isHittable {
            open.tap()
        }
        XCTAssertTrue(draft.waitForExistence(timeout: 15), app.debugDescription)
    }

    private func signIn(_ app: XCUIApplication) {
        let username = app.descendants(matching: .any)["pilot-username"]
        let password = app.descendants(matching: .any)["pilot-password"]
        signIn(app, username: username, password: password)
    }

    private func signInNatively(_ app: XCUIApplication) {
        signIn(app, username: app.textFields["Username or email"], password: app.secureTextFields["Password"])
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
            XCTWaiter.wait(for: [entered], timeout: 10),
            .completed,
            "The input should receive its complete value before continuing."
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
            "--shared-member-pilot",
            "--shared-home",
            "-trustroots.apiServerURL",
            "http://127.0.0.1:\(port)",
            "-AppleLocale",
            "en_US",
        ]
        app.launch()
        addTeardownBlock { [self] in
            app.terminate()
            app.launch()
            signOutIfAlreadySignedIn(app)
        }
        signOutIfAlreadySignedIn(app)
        signIn(app)

        let exitPilot = app.buttons["Exit shared pilot"]
        XCTAssertTrue(exitPilot.waitForExistence(timeout: 15), app.debugDescription)
        exitPilot.tap()
        XCTAssertTrue(app.buttons["Menu"].waitForExistence(timeout: 10), app.debugDescription)
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
