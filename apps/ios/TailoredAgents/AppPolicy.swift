import Foundation

enum AppTab: Int, CaseIterable {
    case mail, dashboard

    var title: String { self == .mail ? "Mail" : "Dashboard" }
    var symbol: String { self == .mail ? "tray" : "square.grid.2x2" }
    var homeURL: URL {
        URL(string: self == .mail
            ? "https://mail.tailoredagents.com/inbox"
            : "https://www.tailoredagents.com/dashboard")!
    }
}

enum AppDestination: Equatable {
    case tab(AppTab)
    case browser
    case googleConnection
    case attachment
    case blocked
}

enum AppPolicy {
    static func tab(for url: URL) -> AppTab? {
        guard url.scheme?.lowercased() == "https", url.user == nil, url.password == nil,
              url.port == nil || url.port == 443 else { return nil }
        switch url.host?.lowercased() {
        case "mail.tailoredagents.com": return .mail
        case "www.tailoredagents.com", "tailoredagents.com": return .dashboard
        default: return nil
        }
    }

    static func destination(for url: URL, source: AppTab) -> AppDestination {
        guard url.user == nil, url.password == nil else { return .blocked }
        let scheme = url.scheme?.lowercased()
        if let tab = tab(for: url) {
            if tab == .dashboard && url.path == "/api/integrations/search-console/connect" {
                return .googleConnection
            }
            return .tab(tab)
        }
        if scheme == "blob", let origin = URL(string: String(url.absoluteString.dropFirst(5))),
           tab(for: origin) == source {
            return .attachment
        }
        // Never downgrade our sites to HTTP or load lookalikes inside the app.
        let ownHosts = ["mail.tailoredagents.com", "www.tailoredagents.com", "tailoredagents.com"]
        if ownHosts.contains(url.host?.lowercased() ?? "") { return .blocked }
        if ["https", "http"].contains(scheme ?? ""), url.host != nil { return .browser }
        if ["mailto", "tel", "sms"].contains(scheme ?? "") { return .browser }
        return .blocked
    }

    static func allowsSubframe(_ url: URL) -> Bool {
        // Mail renders sanitized message bodies in sandboxed srcdoc frames.
        url.absoluteString == "about:blank" || url.absoluteString == "about:srcdoc" || tab(for: url) != nil
    }

    static func shouldDownload(mimeType: String?, disposition: String?, isMainFrame: Bool) -> Bool {
        guard isMainFrame else { return false }
        if disposition?.lowercased().hasPrefix("attachment") == true { return true }
        guard let mime = mimeType?.lowercased() else { return false }
        return mime == "application/pdf" || mime == "text/csv" || mime.hasPrefix("image/")
    }

    static func downloadFilename(_ suggested: String) -> String {
        let last = (suggested.replacingOccurrences(of: "\\", with: "/") as NSString).lastPathComponent
        var name = last.unicodeScalars.filter { !CharacterSet.controlCharacters.contains($0) }
            .map(String.init).joined().trimmingCharacters(in: .whitespacesAndNewlines)
        while name.utf8.count > 200 { name.removeLast() }
        if name.isEmpty || name == "." || name == ".." { return "Attachment" }
        return name
    }
}
