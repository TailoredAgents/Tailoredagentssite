import XCTest

final class WorkspaceUITests: XCTestCase {
    @MainActor
    func testLiveSignInScreensAndTabState() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let mailTab = app.tabBars.buttons["Mail"]
        let dashboardTab = app.tabBars.buttons["Dashboard"]
        XCTAssertTrue(mailTab.waitForExistence(timeout: 15))
        XCTAssertTrue(dashboardTab.exists)

        let email = app.webViews.textFields.firstMatch
        XCTAssertTrue(email.waitForExistence(timeout: 45), "Mail sign-in should load from the existing deployment")
        saveScreenshot("Mail sign-in", app: app)
        email.tap()
        email.typeText("mobile-check@example.invalid")
        // iOS covers the native tab bar while typing; Done must make it reachable.
        let hideKeyboard = app.navigationBars.buttons["Hide keyboard"]
        XCTAssertTrue(hideKeyboard.waitForExistence(timeout: 5))
        hideKeyboard.tap()
        dashboardTab.tap()
        let dashboardEmail = app.webViews.textFields.firstMatch
        XCTAssertTrue(dashboardEmail.waitForExistence(timeout: 45), "Dashboard sign-in should load from Render")
        XCTAssertTrue(app.navigationBars["Dashboard"].waitForExistence(timeout: 10))
        saveScreenshot("Dashboard sign-in", app: app)

        mailTab.tap()
        XCTAssertTrue(app.navigationBars["Mail"].exists)
        XCTAssertEqual(app.webViews.textFields.firstMatch.value as? String, "mobile-check@example.invalid",
                       "Switching tabs should preserve in-progress form input")
        app.navigationBars.buttons["Page options"].tap()
        XCTAssertTrue(app.buttons["Reload"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Open in Safari"].exists)
    }

    @MainActor
    private func saveScreenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
