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
        let moreContacts = app.buttons["More contacts (1)"]
        XCTAssertTrue(moreContacts.waitForExistence(timeout: 15), app.debugDescription)
        let seventhContact = app.descendants(matching: .any)["profile-contact-contact-pilot-7"]
        XCTAssertFalse(seventhContact.exists)
        revealProfileElement(moreContacts, in: app)
        moreContacts.tap()
        XCTAssertTrue(seventhContact.waitForExistence(timeout: 10), app.debugDescription)

        let profileContact = app.descendants(matching: .any)["profile-contact-contact-pilot-one"]
        revealProfileElement(profileContact, in: app)
        let contactScreenshot = XCTAttachment(screenshot: profileContact.screenshot())
        contactScreenshot.name = "regular-ios-profile-contact"
        contactScreenshot.lifetime = .keepAlways
        add(contactScreenshot)
        profileContact.tap()
        XCTAssertTrue(app.staticTexts["A partner profile"].waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Back"].tap()

        let fewerContacts = app.buttons["Show fewer"]
        XCTAssertTrue(fewerContacts.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(fewerContacts, in: app)
        fewerContacts.tap()
        XCTAssertTrue(moreContacts.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(seventhContact.exists)
        let experienceSummary = element(labelled: "1 member shared an experience.", in: app)
        XCTAssertTrue(experienceSummary.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(experienceSummary, in: app)
        XCTAssertTrue(element(labelled: "We shared a good afternoon walk.", in: app).exists, app.debugDescription)
        XCTAssertTrue(element(labelled: "Thanks for showing me the harbour.", in: app).exists, app.debugDescription)
        let author = app.descendants(matching: .any)["profile-experience-author-fixture-public-experience"]
        XCTAssertTrue(author.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(author, in: app)
        let experienceScreenshot = XCTAttachment(screenshot: author.screenshot())
        experienceScreenshot.name = "regular-ios-profile-experience-author"
        experienceScreenshot.lifetime = .keepAlways
        add(experienceScreenshot)
        author.tap()
        XCTAssertTrue(app.staticTexts["A partner profile"].waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Back"].tap()
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
        let activity = app.descendants(matching: .any)["profile-activity-and-locations"]
        XCTAssertTrue(activity.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(activity, in: app)
        XCTAssertTrue(element(labelled: "87%", in: app).exists, app.debugDescription)
        XCTAssertTrue(element(labelled: "Within 2 days", in: app).exists, app.debugDescription)
        let activityScreenshot = XCTAttachment(screenshot: activity.screenshot())
        activityScreenshot.name = "regular-ios-profile-activity"
        activityScreenshot.lifetime = .keepAlways
        add(activityScreenshot)

        let biography = app.descendants(matching: .any)["profile-biography"]
        XCTAssertTrue(biography.waitForExistence(timeout: 10), app.debugDescription)
        let biographyText = "I enjoy exploring on foot, finding local cafés and swapping book recommendations with fellow travellers."
        let biographyLabel = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", biographyText)).firstMatch
        XCTAssertTrue(biographyLabel.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(biographyLabel, in: app)
        XCTAssertEqual(biographyLabel.label.trimmingCharacters(in: .whitespacesAndNewlines), biographyText)
        XCTAssertLessThanOrEqual(biographyLabel.frame.maxY, biography.frame.maxY + 1)
        let profileText = XCTAttachment(screenshot: biography.screenshot())
        profileText.name = "regular-ios-profile-biography"
        profileText.lifetime = .keepAlways
        add(profileText)

        let languages = app.descendants(matching: .any)["profile-languages"]
        XCTAssertTrue(languages.waitForExistence(timeout: 10), app.debugDescription)
        let languageText = element(labelled: "English · French", in: app)
        XCTAssertTrue(languageText.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(languageText, in: app)

        let profileCircle = app.descendants(matching: .any)["profile-circle-fixture-train-circle"]
        XCTAssertTrue(profileCircle.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(profileCircle, in: app)
        let circleScreenshot = XCTAttachment(screenshot: profileCircle.screenshot())
        circleScreenshot.name = "regular-ios-profile-circle-link"
        circleScreenshot.lifetime = .keepAlways
        add(circleScreenshot)
        profileCircle.tap()
        XCTAssertTrue(app.staticTexts["A fictional circle for overnight train travellers."].waitForExistence(timeout: 15))
        app.buttons["Back"].tap()
        XCTAssertTrue(profileCircle.waitForExistence(timeout: 10), app.debugDescription)

        let location = app.buttons["Lives in Example Harbour"]
        XCTAssertTrue(location.exists, app.debugDescription)
        revealProfileElement(location, in: app)
        location.tap()
        let mapOpened = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isSelected == true"),
            object: app.buttons["Search"]
        )
        XCTAssertEqual(XCTWaiter.wait(for: [mapOpened], timeout: 10), .completed, app.debugDescription)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Menu"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Home"].isSelected)
        XCTAssertFalse(app.buttons["Sign in"].exists)
    }

    func testRegularProfileBlockAndUnblockUpdatesMessageAction() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        app.buttons["Menu"].tap()
        let contacts = app.descendants(matching: .any)["contacts-menu-entry"]
        XCTAssertTrue(contacts.waitForExistence(timeout: 10), app.debugDescription)
        contacts.tap()
        let contact = app.descendants(matching: .any)["contact-contact-pilot-one"]
        XCTAssertTrue(contact.waitForExistence(timeout: 15), app.debugDescription)
        contact.tap()

        let message = app.descendants(matching: .any)["profile-message"]
        XCTAssertTrue(message.waitForExistence(timeout: 15), app.debugDescription)
        let block = app.descendants(matching: .any)["profile-block"]
        XCTAssertTrue(block.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(block, in: app)
        let blockScreenshot = XCTAttachment(screenshot: block.screenshot())
        blockScreenshot.name = "regular-ios-profile-block-action"
        blockScreenshot.lifetime = .keepAlways
        add(blockScreenshot)
        block.tap()
        app.buttons["Block member"].tap()

        let blocked = element(labelled: "You have blocked Robin Example.", in: app)
        XCTAssertTrue(blocked.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(message.exists)
        revealProfileElement(block, in: app)
        block.tap()
        app.buttons["Unblock member"].tap()
        XCTAssertTrue(message.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(blocked.exists)
    }

    func testRegularMemberReportKeepsDraftAndRetriesFromCompose() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        app.buttons["Menu"].tap()
        let contacts = app.descendants(matching: .any)["contacts-menu-entry"]
        XCTAssertTrue(contacts.waitForExistence(timeout: 10), app.debugDescription)
        contacts.tap()
        let contact = app.descendants(matching: .any)["contact-contact-pilot-one"]
        XCTAssertTrue(contact.waitForExistence(timeout: 15), app.debugDescription)
        contact.tap()

        let report = app.buttons["Report member to support"]
        XCTAssertTrue(report.waitForExistence(timeout: 15), app.debugDescription)
        revealProfileElement(report, in: app)
        report.tap()
        XCTAssertTrue(app.buttons["Cancel"].waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Cancel"].tap()
        XCTAssertTrue(report.waitForExistence(timeout: 10), app.debugDescription)
        revealProfileElement(report, in: app)
        report.tap()

        XCTAssertTrue(element(labelled: "Robin Example (@pilot-partner)", in: app).waitForExistence(timeout: 10))
        let submit = app.descendants(matching: .any)["report-member-send"]
        XCTAssertTrue(submit.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(submit.isEnabled)

        let message = "A fictional report for the support team."
        let editor = app.textViews["report-member-details"]
        enterText(message, into: editor, in: app)
        let done = app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 10), app.debugDescription)
        done.tap()
        let keyboardClosed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: app.keyboards.firstMatch
        )
        XCTAssertEqual(XCTWaiter.wait(for: [keyboardClosed], timeout: 5), .completed, app.debugDescription)

        reveal(submit, in: app)
        submit.tap()
        let failure = element(labelled: "Temporary fixture report delivery failure.", in: app)
        XCTAssertTrue(failure.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(editor.value as? String, message)

        let actions = app.descendants(matching: .any)["report-member-actions"]
        XCTAssertTrue(actions.exists, app.debugDescription)
        let screenshot = XCTAttachment(screenshot: actions.screenshot())
        screenshot.name = "regular-ios-member-report-retry"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        reveal(submit, in: app)
        submit.tap()
        XCTAssertTrue(element(labelled: "Report sent", in: app).waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(editor.exists)
        app.buttons["Done"].tap()
        XCTAssertTrue(report.waitForExistence(timeout: 10), app.debugDescription)
    }

    func testRegularSupportOpensFAQAndKeepsMessageForRetry() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        app.buttons["Menu"].tap()
        let support = app.descendants(matching: .any)["support-menu-entry"]
        XCTAssertTrue(support.waitForExistence(timeout: 10), app.debugDescription)
        support.tap()

        let faq = app.descendants(matching: .any)["support-faq"]
        XCTAssertTrue(faq.waitForExistence(timeout: 10), app.debugDescription)
        reveal(faq, in: app)
        faq.tap()
        XCTAssertTrue(app.buttons["Back"].waitForExistence(timeout: 10))
        app.buttons["Back"].tap()

        let field = app.descendants(matching: .any)["support-message"]
        let send = app.descendants(matching: .any)["support-send"]
        XCTAssertTrue(send.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(send.isEnabled)
        let draft = "A fixture support request."
        enterText(draft, into: field, in: app)
        reveal(send, in: app)
        send.tap()

        let error = element(labelled: "Temporary fixture support delivery failure.", in: app)
        XCTAssertTrue(error.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(field.value as? String, draft)
        let form = app.descendants(matching: .any)["member-support"]
        XCTAssertTrue(form.exists, app.debugDescription)
        let screenshot = XCTAttachment(screenshot: form.screenshot())
        screenshot.name = "regular-ios-support-retry"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        reveal(send, in: app)
        send.tap()
        XCTAssertTrue(element(labelled: "Message sent", in: app).waitForExistence(timeout: 10))
        XCTAssertFalse(field.exists)
    }

    func testRegularProfileEditorSavesComposeText() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        app.buttons["Menu"].tap()
        let profile = app.descendants(matching: .any)["profile-menu-entry"]
        XCTAssertTrue(profile.waitForExistence(timeout: 10), app.debugDescription)
        profile.tap()
        let edit = app.buttons["Edit profile"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10), app.debugDescription)
        edit.tap()

        let name = app.descendants(matching: .any)["profile-editor-name"]
        let nameLoaded = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "Mira Example"), object: name)
        XCTAssertEqual(XCTWaiter.wait(for: [nameLoaded], timeout: 10), .completed, app.debugDescription)

        let languages = app.descendants(matching: .any)["profile-editor-languages"]
        XCTAssertTrue(languages.exists, app.debugDescription)
        reveal(languages, in: app)
        languages.tap()
        XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Done"].tap()

        let tagline = app.descendants(matching: .any)["profile-editor-tagline"]
        let biography = app.descendants(matching: .any)["profile-editor-biography"]
        appendProfileText(" updated", to: tagline, in: app, expected: "A test profile updated")
        appendProfileText(
            "\nA second line for the profile fixture.",
            to: biography,
            in: app,
            expected: "A fictional profile for simulator testing.\nA second line for the profile fixture."
        )

        let screenshot = XCTAttachment(screenshot: biography.screenshot())
        screenshot.name = "regular-ios-profile-editor-biography"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        let save = app.descendants(matching: .any)["profile-editor-save"]
        XCTAssertTrue(save.waitForExistence(timeout: 10), app.debugDescription)
        reveal(save, in: app)
        save.tap()
        XCTAssertTrue(edit.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts["A test profile updated"].waitForExistence(timeout: 10), app.debugDescription)
    }

    private func appendProfileText(_ text: String, to field: XCUIElement, in app: XCUIApplication, expected: String) {
        XCTAssertTrue(field.waitForExistence(timeout: 10), app.debugDescription)
        reveal(field, in: app)
        // Place the insertion point after the existing text. For multiline Compose
        // fields, tap below the first line so focus leaves any previous input.
        let insertion = field.coordinate(withNormalizedOffset: CGVector(dx: 0.86, dy: 0.75))
        insertion.tap()
        let keyboard = app.keyboards.firstMatch
        if !keyboard.waitForExistence(timeout: 2) { insertion.tap() }
        XCTAssertTrue(keyboard.waitForExistence(timeout: 5), app.debugDescription)
        app.typeText(text)
        let edited = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", expected), object: field)
        XCTAssertEqual(XCTWaiter.wait(for: [edited], timeout: 10), .completed, app.debugDescription)
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

        let hosting = app.descendants(matching: .any)["profile-hosting-summary"]
        XCTAssertTrue(hosting.waitForExistence(timeout: 15), app.debugDescription)
        revealProfileElement(hosting, in: app)
        XCTAssertTrue(element(labelled: "Maybe up for meeting", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element(labelled: "Not hosting currently", in: app).exists)
        XCTAssertFalse(element(labelled: "Offers volunteering", in: app).exists)
        let hostingScreenshot = XCTAttachment(screenshot: hosting.screenshot())
        hostingScreenshot.name = "regular-ios-profile-hosting-status"
        hostingScreenshot.lifetime = .keepAlways
        add(hostingScreenshot)
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
        let detail = app.descendants(matching: .any)["circle-detail"]
        XCTAssertTrue(detail.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(element(labelled: "Night Walkers", in: app).exists)
        XCTAssertTrue(element(labelled: "42 members", in: app).exists)
        XCTAssertTrue(element(labelled: "Bring a lantern.", in: app).exists)
        let member = app.descendants(matching: .any)["circle-detail-member-member-pilot-partner"]
        XCTAssertTrue(member.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(element(labelled: "Your contacts in this circle", in: app).exists)
        let capture = XCTAttachment(screenshot: detail.screenshot())
        capture.name = "regular-ios-circle-detail"
        capture.lifetime = .keepAlways
        add(capture)
        member.tap()
        XCTAssertTrue(element(labelled: "A partner profile", in: app).waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Back"].tap()
        XCTAssertTrue(member.waitForExistence(timeout: 10), app.debugDescription)
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
    func testRegularConversationRestoresDraftAndRetriesOnce() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let fixtureURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)"))
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", fixtureURL.absoluteString]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        func openRegularConversation() {
            let messages = app.buttons["Messages"]
            XCTAssertTrue(messages.waitForExistence(timeout: 15), app.debugDescription)
            messages.tap()
            let row = app.descendants(matching: .any)["message-thread-thread-pilot-1"]
            XCTAssertTrue(row.waitForExistence(timeout: 15), app.debugDescription)
            row.tap()
            XCTAssertTrue(app.staticTexts["Hello from the test fixture."].waitForExistence(timeout: 15))
        }

        openRegularConversation()
        let history = app.descendants(matching: .any)["conversation-history"]
        XCTAssertTrue(history.exists, app.debugDescription)
        let screenshot = XCTAttachment(screenshot: history.screenshot())
        screenshot.name = "regular-ios-conversation-history"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        let profile = app.buttons["View Robin Example's profile"]
        XCTAssertTrue(profile.waitForExistence(timeout: 10), app.debugDescription)
        profile.tap()
        XCTAssertTrue(app.staticTexts["A partner profile"].waitForExistence(timeout: 15))
        app.buttons["Back"].tap()

        let reply = "A regular conversation draft.\nA second paragraph."
        let draft = app.descendants(matching: .any)["conversation-draft"]
        let send = app.descendants(matching: .any)["conversation-send"]
        if draft.value as? String != reply {
            enterText(reply, into: draft, in: app)
        }
        send.tap()
        XCTAssertTrue(element(labelled: "Temporary fixture delivery failure.", in: app).waitForExistence(timeout: 15))
        XCTAssertEqual(draft.value as? String, reply)

        app.terminate()
        app.launch()
        openRegularConversation()
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        XCTAssertEqual(draft.value as? String, reply)
        XCTAssertTrue(send.isEnabled)
        XCTAssertEqual(send.label, "Send message")
        let sendIcon = XCTAttachment(screenshot: send.screenshot())
        sendIcon.name = "regular-ios-send-message-icon"
        sendIcon.lifetime = .keepAlways
        add(sendIcon)
        send.tap()
        XCTAssertTrue(app.staticTexts[reply].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertFalse(send.isEnabled)
        XCTAssertNotEqual(draft.value as? String, reply)

        struct DeliveryState: Decodable { let attempts: Int; let deliveries: Int }
        let (data, response) = try await URLSession.shared.data(
            from: fixtureURL.appendingPathComponent("fixture/reply-state")
        )
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let state = try JSONDecoder().decode(DeliveryState.self, from: data)
        XCTAssertEqual(state.attempts, 2)
        XCTAssertEqual(state.deliveries, 1)
    }

    @MainActor
    func testRegularConversationSharesExperienceAfterManualRetry() async throws {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let fixtureURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)"))
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", fixtureURL.absoluteString]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)

        var prepare = URLRequest(url: fixtureURL.appendingPathComponent("fixture/prepare-experience"))
        prepare.httpMethod = "POST"
        let (_, prepared) = try await URLSession.shared.data(for: prepare)
        XCTAssertEqual((prepared as? HTTPURLResponse)?.statusCode, 200)

        app.buttons["Messages"].tap()
        let thread = app.descendants(matching: .any)["message-thread-thread-pilot-1"]
        XCTAssertTrue(thread.waitForExistence(timeout: 15), app.debugDescription)
        thread.tap()
        let experienceAction = app.buttons["They shared an experience — share yours"]
        XCTAssertTrue(experienceAction.waitForExistence(timeout: 15), app.debugDescription)
        experienceAction.tap()
        XCTAssertTrue(app.navigationBars["Experience with Robin Example"].waitForExistence(timeout: 10))
        let form = app.descendants(matching: .any)["experience-form"]
        XCTAssertTrue(form.waitForExistence(timeout: 10), app.debugDescription)
        let screenshot = XCTAttachment(screenshot: form.screenshot())
        screenshot.name = "regular-ios-conversation-experience"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["Cancel"].tap()
        XCTAssertTrue(experienceAction.waitForExistence(timeout: 10), app.debugDescription)
        experienceAction.tap()

        let met = app.descendants(matching: .any)["experience-met"]
        let hosted = app.descendants(matching: .any)["experience-hosted"]
        let recommendation = app.descendants(matching: .any)["experience-recommend-unknown"]
        let feedback = app.descendants(matching: .any)["experience-feedback"]
        let share = app.descendants(matching: .any)["experience-share"]
        XCTAssertTrue(met.waitForExistence(timeout: 10), app.debugDescription)
        met.tap()
        XCTAssertTrue(share.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(share.isEnabled)
        hosted.tap()
        XCTAssertTrue(share.isEnabled)
        recommendation.tap()
        let comment = " A fictional stay by the sea. "
        enterText(comment, into: feedback, in: app)
        reveal(share, in: app)
        share.tap()
        let failure = element(labelled: "Temporary fixture experience failure.", in: app)
        XCTAssertTrue(failure.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertEqual(feedback.value as? String, comment)
        reveal(share, in: app)
        share.tap()
        XCTAssertTrue(element(labelled: "There is an experience between you", in: app).waitForExistence(timeout: 15))
        XCTAssertFalse(share.exists)

        struct State: Decodable {
            struct Submission: Decodable, Equatable {
                let userTo: String
                let interactions: [String: Bool]
                let recommend: String
                let feedbackPublic: String
            }
            let submissions: [Submission]
            let deliveries: Int
        }
        let (data, response) = try await URLSession.shared.data(
            from: fixtureURL.appendingPathComponent("fixture/experience-state")
        )
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let state = try JSONDecoder().decode(State.self, from: data)
        let submission = State.Submission(
            userTo: "member-pilot-partner",
            interactions: ["met": false, "guest": false, "host": true],
            recommend: "unknown",
            feedbackPublic: "A fictional stay by the sea."
        )
        XCTAssertEqual(state.submissions, [submission, submission])
        XCTAssertEqual(state.deliveries, 1)
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
        XCTAssertTrue(element(labelled: "My profile", in: app).waitForExistence(timeout: 30), app.debugDescription)
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

    func testRegularAccountOpensNativeSigningAndSignsOutFromCompose() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)
        openNostrAccount(app)

        let account = app.scrollViews["account-scroll-view"]
        let heading = account.descendants(matching: .any)["account-overview-heading"]
        XCTAssertTrue(heading.waitForExistence(timeout: 10), app.debugDescription)
        tapAccountButton(app.buttons["Nostranslation signing"], in: app)
        let signing = app.navigationBars["Nostranslation signing"]
        XCTAssertTrue(signing.waitForExistence(timeout: 10), app.debugDescription)
        signing.buttons["Done"].tap()
        XCTAssertTrue(account.waitForExistence(timeout: 10), app.debugDescription)

        tapAccountButton(app.buttons["Sign out"], in: app)
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10), app.debugDescription)
    }

    func testRegularAccountSavesComposeEmailAndNewsletterPreferences() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)
        openNostrAccount(app)

        let field = app.descendants(matching: .any)["account-email"]
        let newsletter = app.descendants(matching: .any)["account-newsletter"]
        let save = app.descendants(matching: .any)["account-save-preferences"]
        XCTAssertTrue(newsletter.waitForExistence(timeout: 10), app.debugDescription)
        tapAccountButton(newsletter, in: app)

        XCTAssertTrue(field.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(field.value as? String, "pilot-member@example.test")
        reveal(field, in: app)
        let fieldEnd = field.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5))
        fieldEnd.tap()
        let keyboard = app.keyboards.firstMatch
        if !keyboard.waitForExistence(timeout: 2) { fieldEnd.tap() }
        XCTAssertTrue(keyboard.waitForExistence(timeout: 5), app.debugDescription)
        app.typeText("x")
        let edited = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "pilot-member@example.testx"),
            object: field
        )
        XCTAssertEqual(XCTWaiter.wait(for: [edited], timeout: 10), .completed, app.debugDescription)

        let done = keyboard.buttons.matching(NSPredicate(format: "label ==[c] %@", "Done")).firstMatch
        XCTAssertTrue(done.waitForExistence(timeout: 5), app.debugDescription)
        done.tap()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: keyboard)
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed, app.debugDescription)

        tapAccountButton(save, in: app)
        let confirmation = element(labelled: "Account settings saved.", in: app)
        XCTAssertTrue(confirmation.waitForExistence(timeout: 10), app.debugDescription)
        let pending = element(labelled: "Email confirmation is pending for pilot-member@example.testx.", in: app)
        XCTAssertTrue(pending.exists, app.debugDescription)

        let section = app.descendants(matching: .any)["account-preferences"]
        XCTAssertTrue(section.exists, app.debugDescription)
        let screenshot = XCTAttachment(screenshot: section.screenshot())
        screenshot.name = "regular-ios-account-preferences-saved"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    func testRegularAccountPasswordActionsUseNativeRecoveryAndSecureInput() {
        continueAfterFailure = false
        let port = ProcessInfo.processInfo.environment["TRUSTROOTS_IOS_PILOT_PORT"] ?? "18765"
        let app = XCUIApplication()
        app.launchArguments = ["-trustroots.apiServerURL", "http://127.0.0.1:\(port)"]
        app.launch()
        addTeardownBlock { [self] in signOutOfNativeAccountIfNeeded(app) }
        signOutOfNativeAccountIfNeeded(app)
        signInToRegularApp(app)
        openNostrAccount(app)

        let recovery = app.descendants(matching: .any)["account-password-recovery"]
        tapAccountButton(recovery, in: app)
        XCTAssertTrue(app.staticTexts["Reset password"].waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Back"].tap()

        let submit = app.descendants(matching: .any)["account-change-password"]
        XCTAssertTrue(submit.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(submit.isEnabled)
        enterText("example-password", into: app.secureTextFields["Current password"], in: app, secure: true)
        enterText("fixture-password-2", into: app.secureTextFields["New password"], in: app, secure: true)
        enterText("fixture-password-2", into: app.secureTextFields["Repeat new password"], in: app, secure: true)

        tapAccountButton(submit, in: app)
        let failure = element(labelled: "Temporary fixture password update failure.", in: app)
        XCTAssertTrue(failure.waitForExistence(timeout: 10), app.debugDescription)
        tapAccountButton(submit, in: app)
        let success = element(labelled: "Your password has been changed.", in: app)
        XCTAssertTrue(success.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(submit.isEnabled)

        let actions = app.descendants(matching: .any)["account-password-actions"]
        XCTAssertTrue(actions.exists, app.debugDescription)
        let screenshot = XCTAttachment(screenshot: actions.screenshot())
        screenshot.name = "regular-ios-password-actions-saved"
        screenshot.lifetime = .keepAlways
        add(screenshot)
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
        let localStatus = app.descendants(matching: .any)["nostr-local-key-status"]
        let profileStatus = app.descendants(matching: .any)["nostr-profile-key-status"]
        let noLocalKey = app.staticTexts["No local key for this account."]
        let noLinkedKey = app.staticTexts["No linked public key."]
        XCTAssertTrue(localStatus.exists, app.debugDescription)
        XCTAssertTrue(profileStatus.exists, app.debugDescription)
        XCTAssertTrue(noLocalKey.waitForExistence(timeout: 10), app.debugDescription)

        let generate = app.buttons["Generate new key"]
        tapAccountButton(generate, in: app)
        let localKey = app.staticTexts["nostr-local-public-key"]
        XCTAssertTrue(localKey.waitForExistence(timeout: 10))
        let publicKey = localKey.label
        XCTAssertTrue(publicKey.hasPrefix("npub1"))
        XCTAssertFalse(noLocalKey.exists)
        XCTAssertTrue(noLinkedKey.exists)

        tapAccountButton(app.buttons["Nostranslation signing"], in: app)
        let signing = app.navigationBars["Nostranslation signing"]
        XCTAssertTrue(signing.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.buttons["Review connection"].exists, app.debugDescription)
        XCTAssertFalse(app.staticTexts["Authorise a translation review"].exists)
        XCTAssertFalse(app.buttons["Approve signature"].exists)
        XCTAssertFalse(app.staticTexts["Connected clients"].exists)
        XCTAssertFalse(app.buttons.matching(identifier: "nostranslation-connected-client-revoke").firstMatch.exists)
        XCTAssertFalse(app.descendants(matching: .any)["nostranslation-review-alerts"].exists)
        XCTAssertFalse(app.buttons["Enable review alerts"].exists)
        app.buttons["Done"].tap()

        let link = app.buttons["Link local key to profile"]
        tapAccountButton(link, in: app)
        let unlink = app.buttons["Unlink profile key"]
        XCTAssertTrue(unlink.waitForExistence(timeout: 10))
        XCTAssertFalse(noLinkedKey.exists)
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
        XCTAssertTrue(noLocalKey.exists)
        XCTAssertFalse(noLinkedKey.exists)
        XCTAssertTrue(unlink.exists)
        attachNostrSection(app, name: "Local key removed without changing profile")
        tapAccountButton(unlink, in: app)
        XCTAssertTrue(app.alerts["Unlink profile key?"].waitForExistence(timeout: 5))
        app.alerts.buttons["Unlink"].tap()
        XCTAssertTrue(noLinkedKey.waitForExistence(timeout: 10))
        for _ in 0..<3 where !profileStatus.isHittable { app.swipeDown() }
        XCTAssertTrue(profileStatus.isHittable, app.debugDescription)
        let statusScreenshot = XCTAttachment(screenshot: profileStatus.screenshot())
        statusScreenshot.name = "regular-ios-nostr-profile-key-status"
        statusScreenshot.lifetime = .keepAlways
        add(statusScreenshot)
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
        let accountScreen = app.scrollViews["account-scroll-view"]
        if !accountScreen.waitForExistence(timeout: 3), account.isHittable {
            account.tap()
        }
        XCTAssertTrue(accountScreen.waitForExistence(timeout: 10), app.debugDescription)
    }

    private func signOutOfNativeAccountIfNeeded(_ app: XCUIApplication) {
        guard app.buttons["Menu"].waitForExistence(timeout: 2) else { return }
        if !app.scrollViews["account-scroll-view"].exists {
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
            // Use the native container's gutter outside the embedded Compose sections.
            let gutter = 8 / account.frame.width
            let start = account.coordinate(withNormalizedOffset: CGVector(dx: gutter, dy: belowCenter ? 0.7 : 0.3))
            let end = account.coordinate(withNormalizedOffset: CGVector(dx: gutter, dy: belowCenter ? 0.3 : 0.7))
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
        let menu = app.buttons["Menu"]
        if !menu.waitForExistence(timeout: 15), app.staticTexts["Signing in…"].exists {
            _ = menu.waitForExistence(timeout: 15)
        }
        XCTAssertTrue(menu.exists, app.debugDescription)
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

    private func revealProfileElement(_ element: XCUIElement, in app: XCUIApplication) {
        let profile = app.scrollViews.firstMatch
        XCTAssertTrue(profile.exists, app.debugDescription)
        let origin = profile.coordinate(withNormalizedOffset: .zero)
        for _ in 0..<5 {
            if element.isHittable { return }
            let frame = profile.frame
            let belowCenter = element.frame.midY >= frame.midY
            // Start in the native profile padding, outside the nested Compose scroll views.
            let start = origin.withOffset(CGVector(dx: 12, dy: frame.height * (belowCenter ? 0.82 : 0.18)))
            let end = origin.withOffset(CGVector(dx: 12, dy: frame.height * (belowCenter ? 0.18 : 0.82)))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
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

        let mapStatus = app.descendants(matching: .any)["compose-map-result-overlay"]
        let legend = app.descendants(matching: .any)["compose-map-marker-legend"]
        XCTAssertTrue(mapStatus.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts["2 offers in this area"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(legend.waitForExistence(timeout: 5), app.debugDescription)
        for label in ["Hosting", "Maybe", "Notes"] {
            XCTAssertTrue(app.staticTexts[label].waitForExistence(timeout: 5), app.debugDescription)
        }
        let statusCapture = XCTAttachment(screenshot: mapStatus.screenshot())
        statusCapture.name = "iOS Compose map status and legend"
        statusCapture.lifetime = .keepAlways
        add(statusCapture)

        let mapFilters = app.descendants(matching: .any)["map-action-filters"]
        let currentLocation = app.descendants(matching: .any)["map-action-current-location"]
        for action in [mapFilters, currentLocation] {
            XCTAssertTrue(action.waitForExistence(timeout: 5), app.debugDescription)
            XCTAssertTrue(action.isHittable, app.debugDescription)
            XCTAssertGreaterThanOrEqual(action.frame.width, 44)
            XCTAssertGreaterThanOrEqual(action.frame.height, 44)
            let actionCapture = XCTAttachment(screenshot: action.screenshot())
            actionCapture.name = "iOS Compose \(action.identifier)"
            actionCapture.lifetime = .keepAlways
            add(actionCapture)
        }
        XCTAssertEqual(mapFilters.label, "Search filters")
        XCTAssertEqual(currentLocation.label, "Use current location")
        mapFilters.tap()
        XCTAssertTrue(app.navigationBars["Search filters"].waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Done"].tap()
        XCTAssertTrue(mapFilters.waitForExistence(timeout: 10), app.debugDescription)

        let capture = XCTAttachment(screenshot: app.screenshot())
        capture.name = "iOS map distance scale"
        capture.lifetime = .keepAlways
        add(capture)

        let mapDisplay = app.descendants(matching: .any)["offer-search-display-map"]
        let resultsDisplay = app.descendants(matching: .any)["offer-search-display-results"]
        let membersDisplay = app.descendants(matching: .any)["offer-search-display-members"]
        XCTAssertTrue(mapDisplay.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(mapDisplay.isSelected)
        resultsDisplay.tap()
        let volunteer = app.buttons["search-result-offer-pilot-volunteer"]
        let other = app.buttons["search-result-offer-pilot-other"]
        XCTAssertTrue(volunteer.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(other.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(resultsDisplay.isSelected)
        XCTAssertFalse(mapDisplay.isSelected)
        let place = app.descendants(matching: .any)["offer-place-search-field"]
        enterText("Example Harbour", into: place, in: app)
        mapDisplay.tap()
        XCTAssertTrue(scale.waitForExistence(timeout: 10), app.debugDescription)
        resultsDisplay.tap()
        XCTAssertTrue(place.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(place.value as? String, "Example Harbour")
        app.descendants(matching: .any)["offer-results-search-filters"].tap()
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
        mapDisplay.tap()
        XCTAssertTrue(scale.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts["1 offers in this area"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(legend.exists, app.debugDescription)
        XCTAssertTrue(app.staticTexts["Hosting"].exists, app.debugDescription)
        XCTAssertFalse(app.staticTexts["Notes"].exists, app.debugDescription)
        resultsDisplay.tap()
        XCTAssertTrue(volunteer.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertFalse(other.exists)
        volunteer.tap()
        XCTAssertTrue(app.buttons["Dismiss potential host"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Might meet"].firstMatch.exists)
        XCTAssertTrue(app.staticTexts["Offers volunteering"].firstMatch.exists)
        mapDisplay.tap()
        let mapPin = app.buttons["View potential host"]
        XCTAssertTrue(mapPin.waitForExistence(timeout: 15), app.debugDescription)
        mapPin.tap()
        let openProfile = app.buttons["View Robin Example's profile"]
        XCTAssertTrue(openProfile.waitForExistence(timeout: 10), app.debugDescription)
        openProfile.tap()
        let profileHeader = app.descendants(matching: .any)["profile-header-content"]
        XCTAssertTrue(profileHeader.waitForExistence(timeout: 15), app.debugDescription)
        let profileIdentity = app.descendants(matching: .any)["profile-header-identity"]
        let profileBack = app.buttons["profile-header-back"]
        XCTAssertTrue(profileIdentity.exists, app.debugDescription)
        XCTAssertTrue(profileBack.exists, app.debugDescription)
        XCTAssertLessThanOrEqual(profileBack.frame.maxY, profileIdentity.frame.minY)
        XCTAssertTrue(app.staticTexts["A partner profile"].exists, app.debugDescription)
        let headerScreenshot = XCTAttachment(screenshot: profileHeader.screenshot())
        headerScreenshot.name = "regular-ios-compose-profile-header"
        headerScreenshot.lifetime = .keepAlways
        add(headerScreenshot)
        profileBack.tap()
        XCTAssertTrue(scale.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(openProfile.waitForExistence(timeout: 10), app.debugDescription)

        app.buttons["Dismiss potential host"].tap()
        mapFilters.tap()
        app.buttons["Reset"].tap()
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["2 offers in this area"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Notes"].exists, app.debugDescription)
        resultsDisplay.tap()
        XCTAssertTrue(other.waitForExistence(timeout: 15), app.debugDescription)

        membersDisplay.tap()
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
        let partner = app.descendants(matching: .any)["member-search-result-pilot-partner"]
        XCTAssertTrue(partner.waitForExistence(timeout: 10), app.debugDescription)
        mapDisplay.tap()
        XCTAssertTrue(scale.waitForExistence(timeout: 10), app.debugDescription)
        membersDisplay.tap()
        XCTAssertTrue(query.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(query.value as? String, "partner profile")
        XCTAssertTrue(membersDisplay.isSelected)
        XCTAssertTrue(partner.waitForExistence(timeout: 10), app.debugDescription)
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
