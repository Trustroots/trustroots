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
            "-trustroots.apiServerURL",
            fixtureURL.absoluteString,
        ]

        app.launch()
        addTeardownBlock { [self] in
            signOutIfAlreadySignedIn(app)
        }
        signOutIfAlreadySignedIn(app)
        signIn(app)

        XCTAssertTrue(app.buttons["My profile"].waitForExistence(timeout: 15))
        XCTAssertTrue(element(labelled: "A fictional Trustroots update.", in: app).waitForExistence(timeout: 10))
        let home = XCTAttachment(screenshot: app.screenshot())
        home.name = "shared-member-dashboard"
        home.lifetime = .keepAlways
        add(home)
        app.buttons["My profile"].tap()
        let profile = element(labelled: "Mira Example", in: app)
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Back"].tap()
        app.buttons["Open native app"].tap()
        XCTAssertTrue(app.buttons["Menu"].waitForExistence(timeout: 10))

        app.terminate()
        try await updateFixtureSession("expire-access-token", at: fixtureURL)
        app.launch()
        XCTAssertTrue(app.buttons["My profile"].waitForExistence(timeout: 10))
        app.buttons["My profile"].tap()
        XCTAssertTrue(
            element(labelled: "A test profile after refresh 1", in: app).waitForExistence(timeout: 15),
            "The saved session should refresh and load the profile after relaunch.\n\(app.debugDescription)"
        )
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()
        app.buttons["Messages"].tap()
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
        XCTAssertTrue(app.buttons["My profile"].waitForExistence(timeout: 10))
        app.buttons["Messages"].tap()
        app.buttons["Open conversation"].tap()
        XCTAssertTrue(app.staticTexts["Hello from the test fixture."].waitForExistence(timeout: 15))
        XCTAssertEqual(draft.value as? String, "A reply kept after a delivery failure.")
        XCTAssertTrue(app.buttons["Send reply"].isEnabled)
        app.buttons["Send reply"].tap()
        XCTAssertTrue(app.staticTexts["A reply kept after a delivery failure."].waitForExistence(timeout: 10))

        app.terminate()
        // The fixture rejects the original refresh token after the first rotation.
        try await updateFixtureSession("expire-access-token", at: fixtureURL)
        app.launch()
        XCTAssertTrue(app.buttons["My profile"].waitForExistence(timeout: 10))
        app.buttons["My profile"].tap()
        XCTAssertTrue(
            element(labelled: "A test profile after refresh 2", in: app).waitForExistence(timeout: 15),
            "The rotated refresh token should survive relaunch.\n\(app.debugDescription)"
        )
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()
        app.buttons["Messages"].tap()
        app.buttons["Open conversation"].tap()
        XCTAssertTrue(app.staticTexts["A reply kept after a delivery failure."].waitForExistence(timeout: 10))
        XCTAssertTrue(draft.exists)
        XCTAssertFalse(app.buttons["Send reply"].isEnabled)

        app.buttons["Back"].tap()
        app.buttons["Back"].tap()
        app.buttons["My profile"].tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))

        signIn(app)
        XCTAssertTrue(app.buttons["My profile"].waitForExistence(timeout: 10))
        app.buttons["My profile"].tap()
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Back"].tap()
        try await updateFixtureSession("revoke-session", at: fixtureURL)
        app.buttons["Messages"].tap()

        let sessionExpired = element(
            labelled: "Your session expired or is no longer valid. Please sign in again.",
            in: app
        )
        XCTAssertTrue(sessionExpired.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.buttons["Sign in"].exists)
        XCTAssertFalse(app.buttons["Messages"].exists)

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

    private func element(labelled label: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func signIn(_ app: XCUIApplication) {
        let username = app.descendants(matching: .any)["pilot-username"]
        let password = app.descendants(matching: .any)["pilot-password"]
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
            "The pilot should enable sign in after receiving both credentials."
        )
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
        field.tap()
        // Compose exposes its inputs as text views. Send keys to that input,
        // rather than whichever element the application still considers focused.
        field.typeText(text)
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
        if app.buttons["My profile"].waitForExistence(timeout: 2) {
            app.buttons["My profile"].tap()
        }
        let signOut = app.buttons["Sign out"]
        guard signOut.waitForExistence(timeout: 2) else { return }
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

        let profile = element(labelled: "A test profile", in: app)
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        let banner = app.descendants(matching: .any)["offline-saved-data"].firstMatch
        XCTAssertFalse(banner.exists)

        try await setDroppedProfileResponse(true, at: fixtureURL)
        app.terminate()
        app.launch()
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(banner.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(banner.label.hasPrefix("Offline — saved "))
        let capture = XCTAttachment(data: app.screenshot().pngRepresentation, uniformTypeIdentifier: "public.png")
        capture.name = "Compose pilot showing a cached profile"
        capture.lifetime = .keepAlways
        add(capture)

        try await setDroppedProfileResponse(false, at: fixtureURL)
        app.buttons["Messages"].tap()
        XCTAssertTrue(app.staticTexts["Robin Example"].waitForExistence(timeout: 10), app.debugDescription)
        let bannerCleared = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: banner)
        XCTAssertEqual(XCTWaiter.wait(for: [bannerCleared], timeout: 10), .completed, app.debugDescription)
        app.buttons["Back"].tap()
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
