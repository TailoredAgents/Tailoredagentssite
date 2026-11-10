import UIKit
import WebKit
import UserNotifications
import Security
import CryptoKit

// No credentials or device tokens cross the JavaScript bridge. The server uses the
// Dashboard cookie to choose the employee; notification payloads contain IDs only.
@MainActor
final class PushCoordinator: NSObject, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
    static let shared = PushCoordinator()
    weak var webView: WKWebView?
    weak var presenter: UIViewController?
    var openDashboard: ((URL) -> Void)?
    private let defaults = UserDefaults.standard
    private var token: String?
    private var enabling = false
    private var syncing = false
    private var bindingEpoch = 0
    private var pending: [AnyHashable: Any]?
    private var handlingPending = false
    private let endpoint = URL(string: "https://www.tailoredagents.com/api/assistant/push")!
    private let redirectGuard = PushRedirectGuard()
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config, delegate: redirectGuard, delegateQueue: nil)
    }()
    private var environment: String? {
        let value = Bundle.main.object(forInfoDictionaryKey: "TAAPNSEnvironment") as? String
        return ["development", "production"].contains(value ?? "") ? value : nil
    }
    private func tokenHash(_ value: String) -> String { SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined() }
    private struct Binding: Codable { let installationId: String; let secret: String }
    private func binding() throws -> Binding {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.tailoredagents.workspace.push", kSecAttrAccount as String: "installation"]
        var result: CFTypeRef?
        var read = query
        read[kSecReturnData as String] = true
        read[kSecMatchLimit as String] = kSecMatchLimitOne
        let status = SecItemCopyMatching(read as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data { return try JSONDecoder().decode(Binding.self, from: data) }
        guard status == errSecItemNotFound else { throw PushFailure.message("Unlock this iPhone and try again.") }
        var random = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, random.count, &random) == errSecSuccess else { throw PushFailure.message("Could not prepare this device.") }
        let secret = Data(random).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        let value = Binding(installationId: UUID().uuidString.lowercased(), secret: secret)
        var insert = query
        insert[kSecValueData as String] = try JSONEncoder().encode(value)
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(insert as CFDictionary, nil) == errSecSuccess else { throw PushFailure.message("Could not save this notification device.") }
        return value
    }
    private func request(_ operation: String, fields: [String: Any] = [:]) async throws -> [String: Any] {
        let identity = try binding()
        var payload = fields
        payload["operation"] = operation
        payload["installationId"] = identity.installationId
        payload["secret"] = identity.secret
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("https://www.tailoredagents.com", forHTTPHeaderField: "Origin")
        if let store = webView?.configuration.websiteDataStore.httpCookieStore {
            let cookies: [HTTPCookie] = await withCheckedContinuation { continuation in
                store.getAllCookies { continuation.resume(returning: $0) }
            }
            let allowed = cookies.filter {
                ["www.tailoredagents.com", ".www.tailoredagents.com", ".tailoredagents.com"].contains($0.domain.lowercased()) &&
                endpoint.path.hasPrefix($0.path) && ($0.expiresDate == nil || $0.expiresDate! > Date())
            }
            for (key, value) in HTTPCookie.requestHeaderFields(with: allowed) { request.setValue(value, forHTTPHeaderField: key) }
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.url == endpoint else { throw PushFailure.message("Notification connection failed.") }
        let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if http.statusCode == 401 { throw PushFailure.signedOut }
        guard (200..<300).contains(http.statusCode) else {
            throw PushFailure.message(result["error_description"] as? String ?? "Notifications are unavailable. Try again later.")
        }
        return result
    }
    func attach(_ webView: WKWebView, presenter: UIViewController) {
        self.webView = webView
        self.presenter = presenter
        UNUserNotificationCenter.current().delegate = self
    }
    func showSettings() {
        guard let presenter, presenter.presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Assistant notifications", message: environment == nil ?
            "This build uses SMS alerts. Native push needs an Apple Developer membership and a push-enabled signed build." :
            "Enable alerts for the employee signed in to Dashboard. SMS remains available in Assistant → Notification settings.", preferredStyle: .alert)
        if environment != nil {
            alert.addAction(UIAlertAction(title: "Enable on this iPhone", style: .default) { _ in Task { await self.enable() } })
            alert.addAction(UIAlertAction(title: "Disable on this iPhone", style: .destructive) { _ in Task { await self.revoke(showResult: true) } })
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        presenter.present(alert, animated: true)
    }
    private func notice(_ message: String) {
        guard let presenter, presenter.viewIfLoaded?.window != nil, presenter.presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Assistant notifications", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        presenter.present(alert, animated: true)
    }
    private func enable() async {
        guard environment != nil, !enabling else { return }
        do {
            if defaults.bool(forKey: "pushRevokePending") { try await finishRevocation() }
            let status = try await request("status")
            guard status["configured"] as? Bool == true else { throw PushFailure.message("Native push is not enabled by your company yet. Use SMS alerts for now.") }
            guard try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) else {
                await revoke(showResult: false)
                throw PushFailure.message("Notifications are disabled in iPhone Settings. SMS alerts remain available.")
            }
            enabling = true
            UIApplication.shared.registerForRemoteNotifications()
        } catch { notice(error.localizedDescription) }
    }
    func registered(_ data: Data) {
        token = data.map { String(format: "%02x", $0) }.joined()
        Task { await registerIfNeeded() }
    }
    func registrationFailed() {
        enabling = false
        notice("Apple could not register this build for push. Check its signing and push entitlement. SMS alerts remain available.")
    }
    private func registerIfNeeded() async {
        guard let token, let environment else { return }
        let epoch = bindingEpoch
        let explicitlyEnabled = enabling
        enabling = false
        do {
            guard !defaults.bool(forKey: "pushRevokePending") else { return }
            let status = try await request("status")
            guard let account = status["account"] as? String else { return }
            if !explicitlyEnabled {
                guard defaults.string(forKey: "pushAccount") == account,
                    let device = status["device"] as? [String: Any], device["enabled"] as? Bool == true else { return }
                if defaults.string(forKey: "pushToken") == tokenHash(token) { await handlePending(); return }
            }
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            guard [.authorized, .provisional].contains(settings.authorizationStatus) else { await revoke(showResult: false); return }
            let result = try await request("register", fields: ["token": token, "environment": environment,
                "permission": settings.authorizationStatus == .provisional ? "provisional" : "authorized"])
            guard epoch == bindingEpoch else { await revoke(showResult: false); return }
            defaults.set(result["account"] as? String, forKey: "pushAccount")
            defaults.set(tokenHash(token), forKey: "pushToken")
            if explicitlyEnabled { notice(result["verified"] as? Bool == true ? "This iPhone is verified for assistant alerts." : (result["message"] as? String ?? "Open the verification notification to finish setup.")) }
            await handlePending()
        } catch {
            if epoch != bindingEpoch { await revoke(showResult: false) }
            else if explicitlyEnabled { notice(error.localizedDescription) }
        }
    }
    private func finishRevocation() async throws {
        _ = try await request("revoke")
        defaults.set(false, forKey: "pushRevokePending")
    }
    private func revoke(showResult: Bool) async {
        bindingEpoch += 1
        enabling = false
        pending = nil
        defaults.removeObject(forKey: "pushAccount")
        defaults.removeObject(forKey: "pushToken")
        defaults.set(true, forKey: "pushRevokePending")
        UIApplication.shared.unregisterForRemoteNotifications()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        do { try await finishRevocation(); if showResult { notice("Notifications disabled for this iPhone.") } }
        catch { if showResult { notice("Removal will retry when the app reconnects. You can also remove this device in Dashboard → Assistant → Notification settings.") } }
    }
    func synchronize() {
        guard !syncing, webView != nil,
              environment != nil || pending != nil || defaults.bool(forKey: "pushRevokePending") else { return }
        syncing = true
        Task {
            defer { syncing = false }
            do {
                if defaults.bool(forKey: "pushRevokePending") { try await finishRevocation() }
                let status = try await request("status")
                if status["boundElsewhere"] as? Bool == true { await revoke(showResult: false); return }
                if let oldAccount = defaults.string(forKey: "pushAccount"), let account = status["account"] as? String, oldAccount != account {
                    await revoke(showResult: false)
                    return
                }
                let settings = await UNUserNotificationCenter.current().notificationSettings()
                if settings.authorizationStatus == .denied, defaults.string(forKey: "pushAccount") != nil {
                    await revoke(showResult: false)
                    return
                }
                if environment != nil, defaults.string(forKey: "pushAccount") != nil { UIApplication.shared.registerForRemoteNotifications() }
                await handlePending()
            } catch { /* Session expiry does not revoke opt-in; opening an alert requires sign-in. */ }
        }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "https",
              message.frameInfo.securityOrigin.host == "www.tailoredagents.com",
              message.frameInfo.securityOrigin.port == 0 || message.frameInfo.securityOrigin.port == 443,
              message.webView === webView, let body = message.body as? [String: String], body.count == 1 else { return }
        if body["action"] == "signOut" { Task { await revoke(showResult: false) } }
        if body["action"] == "sync" { synchronize() }
    }
    func received(_ payload: [AnyHashable: Any], opened: Bool) {
        guard let device = payload["ta_device"] as? String, UUID(uuidString: device) != nil else { return }
        if let code = payload["ta_verify"] as? String, code.count == 43 {
            pending = payload
        } else if opened, let id = payload["ta_notification"] as? String, UUID(uuidString: id) != nil {
            pending = payload
        } else { return }
        if opened { openDashboard?(URL(string: "https://www.tailoredagents.com/dashboard/assistant")!) }
        Task { await handlePending() }
    }
    private func handlePending() async {
        guard !handlingPending, let payload = pending, let device = payload["ta_device"] as? String else { return }
        handlingPending = true
        defer { handlingPending = false }
        do {
            if let code = payload["ta_verify"] as? String {
                let settings = await UNUserNotificationCenter.current().notificationSettings()
                guard [.authorized, .provisional].contains(settings.authorizationStatus) else { return }
                let result = try await request("confirm", fields: ["id": device, "code": code])
                defaults.set(result["account"] as? String, forKey: "pushAccount")
                notice("This iPhone is verified for assistant alerts.")
            } else if let id = payload["ta_notification"] as? String {
                let result = try await request("open", fields: ["id": device, "notificationId": id])
                guard let path = result["path"] as? String, let url = PushPolicy.destination(path) else { throw PushFailure.message("This notification link is unavailable.") }
                openDashboard?(url)
            }
            pending = nil
        } catch PushFailure.signedOut { /* Keep in memory until the employee signs in. */ }
        catch { pending = nil; notice(error.localizedDescription) }
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        Task { @MainActor in self.received(notification.request.content.userInfo, opened: false) }
        completionHandler([.banner, .sound, .list])
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void) {
        Task { @MainActor in self.received(response.notification.request.content.userInfo, opened: true) }
        completionHandler()
    }
}

private enum PushFailure: LocalizedError {
    case signedOut, message(String)
    var errorDescription: String? {
        switch self {
        case .signedOut: return "Sign in to Dashboard to use assistant notifications."
        case .message(let text): return text
        }
    }
}
private final class PushRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
