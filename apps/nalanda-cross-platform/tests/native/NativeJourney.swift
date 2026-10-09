import XCTest

// Real XCUI actions against the existing compiled app. Raw XCResult stays private.
final class NativeJourney: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.nalandaps.erp")
    let pin = String(Int.random(in: 10000000...99999999))
    func text(_ value: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", value)).firstMatch
    }
    func require(_ value: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(text(value).waitForExistence(timeout: 30), "Expected native state: \(value)", file: file, line: line)
    }
    func tap(_ value: String) {
        let button = app.buttons[value].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 30))
        if !button.isHittable { app.swipeUp() }
        XCTAssertTrue(button.isHittable); XCTAssertTrue(button.isEnabled); button.tap()
    }
    func locked() {
        require("Welcome back")
        for value in ["April fee", "Science lab supplies", "Hall booking", "Recent drafts"] { XCTAssertFalse(text(value).exists) }
    }
    func unlock(_ value: String) {
        let field = app.secureTextFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 30)); field.tap(); field.typeText(value)
        tap("Unlock app"); XCTAssertTrue(app.buttons["Workspace"].firstMatch.waitForExistence(timeout: 30)); tap("Workspace"); require("Recent drafts")
    }
    func testNoRemoteJourney() {
        continueAfterFailure = false
        XCTContext.runActivity(named: "A-clean-launch") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:A-clean-launch")
            app.launch(); locked(); require("NO REMOTE SERVER CONFIGURED"); require("App 0.1.0")
            print("NALANDA_NATIVE_SCENARIO:PASS:A-clean-launch")
        }
        XCTContext.runActivity(named: "B-invalid-pin") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:B-invalid-pin")
            XCTAssertFalse(app.buttons["Unlock app"].firstMatch.isEnabled)
            app.secureTextFields.firstMatch.tap(); app.secureTextFields.firstMatch.typeText("123")
            XCTAssertFalse(app.buttons["Unlock app"].firstMatch.isEnabled); require("Use an 8–12 digit app PIN.")
            app.terminate(); app.launch(); locked()
            print("NALANDA_NATIVE_SCENARIO:PASS:B-invalid-pin")
        }
        XCTContext.runActivity(named: "C-local-vault-empty") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:C-local-vault-empty")
            unlock(pin); require("0 items"); require("No remote server is configured.")
            print("NALANDA_NATIVE_SCENARIO:PASS:C-local-vault-empty")
        }
        XCTContext.runActivity(named: "F-remote-reference-draft-refusal") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:F-remote-reference-draft-refusal")
            tap("Security"); require("The server still decides")
            XCTAssertFalse(app.buttons["No remote server configured"].firstMatch.isEnabled)
            XCTAssertFalse(app.buttons["Download encrypted reference data"].firstMatch.isEnabled)
            tap("Workspace")
            let summary = app.textFields["Student, vendor or purpose"].firstMatch
            let amount = app.textFields["Amount (₹)"].firstMatch
            XCTAssertTrue(summary.exists); summary.tap(); summary.typeText("Synthetic purpose")
            XCTAssertTrue(amount.exists); amount.tap(); amount.typeText("1.00")
            tap("Save encrypted draft"); require("Connect once and download current reference data before creating an offline draft."); require("0 items")
            print("NALANDA_NATIVE_SCENARIO:PASS:F-remote-reference-draft-refusal")
        }
        XCTContext.runActivity(named: "D-explicit-lock-and-os-background") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:D-explicit-lock-and-os-background")
            tap("Lock"); locked(); unlock(pin)
            XCUIDevice.shared.press(.home); app.activate(); locked(); unlock(pin)
            print("NALANDA_NATIVE_SCENARIO:PASS:D-explicit-lock-and-os-background")
        }
        XCTContext.runActivity(named: "E-cold-restart-wrong-pin") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:E-cold-restart-wrong-pin")
            app.terminate(); app.launch(); locked()
            unlockWrongPin(); app.terminate(); app.launch(); unlock(pin)
            print("NALANDA_NATIVE_SCENARIO:PASS:E-cold-restart-wrong-pin")
        }
        XCTContext.runActivity(named: "G-reset-cancel-confirm") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:G-reset-cancel-confirm")
            tap("Security"); tap("Reset app data"); tap("Cancel"); require("The server still decides")
            tap("Lock"); locked(); unlock(pin)
            tap("Security"); tap("Reset app data")
            let confirmation = app.textFields["Type ERASE LOCAL DRAFTS"].firstMatch
            XCTAssertTrue(confirmation.exists); confirmation.tap(); confirmation.typeText("ERASE LOCAL DRAFTS")
            tap("Erase this app's local data"); locked()
            let replacement = pin == "31415926" ? "27182818" : "31415926"
            unlock(replacement); require("0 items") // waits for the real reset barrier
            app.terminate(); app.launch(); unlock(replacement); require("0 items")
            print("NALANDA_NATIVE_SCENARIO:PASS:G-reset-cancel-confirm")
        }
        XCTContext.runActivity(named: "H-platform-accessibility-layout") { _ in
            print("NALANDA_NATIVE_SCENARIO:BEGIN:H-platform-accessibility-layout")
            tap("Lock"); locked()
            XCUIDevice.shared.orientation = .landscapeLeft; locked()
            XCTAssertTrue(app.secureTextFields.firstMatch.isHittable)
            XCUIDevice.shared.orientation = .portrait; locked()
            print("NALANDA_NATIVE_SCENARIO:PASS:H-platform-accessibility-layout")
        }
        app.terminate()
    }
    func unlockWrongPin() {
        app.secureTextFields.firstMatch.tap(); app.secureTextFields.firstMatch.typeText(pin == "31415926" ? "27182818" : "31415926")
        tap("Unlock app"); require("App PIN was not accepted."); locked()
    }
    func testDarkLockedLayout() {
        continueAfterFailure = false
        app.launch(); locked(); require("NO REMOTE SERVER CONFIGURED")
        app.secureTextFields.firstMatch.tap(); XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .landscapeLeft; locked()
        XCTAssertTrue(app.secureTextFields.firstMatch.isHittable)
        XCUIDevice.shared.orientation = .portrait; app.terminate()
    }
}
