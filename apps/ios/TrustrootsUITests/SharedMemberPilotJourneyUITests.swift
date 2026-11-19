import XCTest

final class SharedMemberPilotJourneyUITests: XCTestCase {
    func testMemberJourneyRetainsFailedReplyAndUsesSavedSession() throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = [
            "--shared-member-pilot",
            "-trustroots.apiServerURL",
            "http://127.0.0.1:\(port)",
        ]

        app.launch()
        addTeardownBlock { [self] in
            signOutIfAlreadySignedIn(app)
        }
        signOutIfAlreadySignedIn(app)
        signIn(app)

        let profile = element(labelled: "Mira Example", in: app)
        XCTAssertTrue(profile.waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Open native app"].tap()
        XCTAssertTrue(app.buttons["Menu"].waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 10))
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
        app.buttons["Send reply"].tap()
        XCTAssertTrue(app.staticTexts["A reply kept after a delivery failure."].waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 10))
        app.buttons["Messages"].tap()
        app.buttons["Open conversation"].tap()
        XCTAssertTrue(app.staticTexts["A reply kept after a delivery failure."].waitForExistence(timeout: 10))

        app.buttons["Back"].tap()
        app.buttons["Back"].tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
    }

    func testNostrLocalKeySurvivesSignOutAndRemovalKeepsProfileSeparate() throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = [
            "--shared-member-pilot",
            "-trustroots.apiServerURL", "http://127.0.0.1:\(port)",
        ]
        app.launch()
        addTeardownBlock { [self] in
            signOutIfAlreadySignedIn(app)
        }
        signOutIfAlreadySignedIn(app)
        signIn(app)
        XCTAssertTrue(app.buttons["Open native app"].waitForExistence(timeout: 15))
        app.buttons["Open native app"].tap()
        openNostrAccount(app)

        // Simulator Keychain survives reinstall/relaunch. Start with this fixture's
        // key removed so the journey is repeatable without touching profile links.
        if app.buttons["Remove local key"].exists {
            reveal(app.buttons["Remove local key"], in: app)
            app.buttons["Remove local key"].tap()
            app.alerts.buttons["Remove"].tap()
        }
        let generate = app.buttons["Generate new key"]
        XCTAssertTrue(generate.waitForExistence(timeout: 10))
        reveal(generate, in: app)
        generate.tap()
        let localKey = app.staticTexts["nostr-local-public-key"]
        XCTAssertTrue(localKey.waitForExistence(timeout: 10))
        let publicKey = localKey.label
        XCTAssertTrue(publicKey.hasPrefix("npub1"))
        XCTAssertTrue(app.staticTexts["No linked public key."].exists)
        let link = app.buttons["Link local key to profile"]
        XCTAssertTrue(link.waitForExistence(timeout: 10))
        reveal(link, in: app)
        link.tap()
        let unlink = app.buttons["Unlink profile key"]
        XCTAssertTrue(unlink.waitForExistence(timeout: 10))
        attachNostrSection(app, name: "Local Nostr key and linked profile key")

        let signOut = app.buttons["Sign out"]
        reveal(signOut, in: app)
        signOut.tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
        app.terminate()
        app.launch()
        signIn(app)
        XCTAssertTrue(app.buttons["Open native app"].waitForExistence(timeout: 15))
        app.buttons["Open native app"].tap()
        openNostrAccount(app)
        XCTAssertTrue(localKey.waitForExistence(timeout: 10))
        XCTAssertEqual(localKey.label, publicKey)

        let remove = app.buttons["Remove local key"]
        reveal(remove, in: app)
        remove.tap()
        XCTAssertTrue(app.alerts["Remove local Nostr key?"].waitForExistence(timeout: 5))
        app.alerts.buttons["Cancel"].tap()
        XCTAssertTrue(localKey.exists)
        remove.tap()
        app.alerts.buttons["Remove"].tap()
        XCTAssertTrue(generate.waitForExistence(timeout: 10))
        XCTAssertFalse(localKey.exists)
        XCTAssertTrue(unlink.exists)
        attachNostrSection(app, name: "Local key removed without changing profile")
        reveal(unlink, in: app)
        unlink.tap()
        XCTAssertTrue(app.alerts["Unlink profile key?"].waitForExistence(timeout: 5))
        app.alerts.buttons["Unlink"].tap()
        XCTAssertTrue(app.staticTexts["No linked public key."].waitForExistence(timeout: 10))
        reveal(signOut, in: app)
        signOut.tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
    }

    private func openNostrAccount(_ app: XCUIApplication) {
        let account = app.buttons["Account"].firstMatch
        XCTAssertTrue(account.waitForExistence(timeout: 10))
        account.tap()
        XCTAssertTrue(app.staticTexts["Local public key (npub)"].waitForExistence(timeout: 10))
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
        let signOut = app.buttons["Sign out"]
        guard signOut.waitForExistence(timeout: 2) else { return }
        reveal(signOut, in: app)
        signOut.tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
    }
}
