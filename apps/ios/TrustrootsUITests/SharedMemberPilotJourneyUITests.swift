import XCTest

final class SharedMemberPilotJourneyUITests: XCTestCase {
    func testMemberJourneyRetainsFailedReplyAndUsesSavedSession() throws {
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

        XCTAssertTrue(app.staticTexts["Mira Example"].waitForExistence(timeout: 10))
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
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        draft.tap()
        draft.typeText("A reply kept after a delivery failure.")
        app.buttons["Send reply"].tap()

        XCTAssertTrue(app.staticTexts["Temporary fixture delivery failure."].waitForExistence(timeout: 10))
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

    private func signIn(_ app: XCUIApplication) {
        let username = app.descendants(matching: .any)["pilot-username"]
        let password = app.descendants(matching: .any)["pilot-password"]
        XCTAssertTrue(username.waitForExistence(timeout: 10))
        username.tap()
        username.typeText("pilot-member")
        password.tap()
        password.typeText("example-password")
        app.buttons["Sign in"].tap()
    }

    private func signOutIfAlreadySignedIn(_ app: XCUIApplication) {
        let signOut = app.buttons["Sign out"]
        guard signOut.waitForExistence(timeout: 2) else { return }
        signOut.tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
    }
}
