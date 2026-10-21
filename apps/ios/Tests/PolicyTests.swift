import Foundation

@main
enum PolicyTests {
    static func main() {
        let destinations: [(String, AppTab, AppDestination)] = [
            ("https://mail.tailoredagents.com/inbox", .mail, .tab(.mail)),
            ("https://www.tailoredagents.com/dashboard?site=123", .mail, .tab(.dashboard)),
            ("https://tailoredagents.com/dashboard", .mail, .tab(.dashboard)),
            ("https://MAIL.tailoredagents.com:443/mail/123", .dashboard, .tab(.mail)),
            ("https://www.tailoredagents.com/api/integrations/search-console/connect?site=123", .dashboard, .googleConnection),
            ("https://mail.tailoredagents.com.evil.example/inbox", .mail, .browser),
            ("https://tailoredagents.com@evil.example/", .mail, .blocked),
            ("https://evil.example@mail.tailoredagents.com/", .mail, .blocked),
            ("http://mail.tailoredagents.com/inbox", .mail, .blocked),
            ("https://mail.tailoredagents.com:8443/inbox", .mail, .blocked),
            ("https://accounts.google.com/", .dashboard, .browser),
            ("mailto:person@example.com?subject=Hello", .mail, .browser),
            ("tel:+15551234567", .dashboard, .browser),
            ("sms:+15551234567", .dashboard, .browser),
            ("file:///private/test.txt", .mail, .blocked),
            ("javascript:alert(1)", .mail, .blocked),
            ("data:text/html,hello", .mail, .blocked),
            ("about:blank", .mail, .blocked),
            ("customapp://anything", .mail, .blocked),
            ("blob:https://mail.tailoredagents.com/123", .mail, .attachment),
            ("blob:https://www.tailoredagents.com/123", .dashboard, .attachment),
            ("blob:https://evil.example/123", .mail, .blocked),
            ("blob:https://mail.tailoredagents.com/123", .dashboard, .blocked),
        ]
        for (raw, source, expected) in destinations {
            precondition(AppPolicy.destination(for: URL(string: raw)!, source: source) == expected, "Navigation: \(raw)")
        }
        precondition(AppPolicy.allowsSubframe(URL(string: "about:srcdoc")!))
        precondition(AppPolicy.allowsSubframe(URL(string: "about:blank")!))
        precondition(!AppPolicy.allowsSubframe(URL(string: "https://evil.example/")!))
        precondition(AppPolicy.shouldDownload(mimeType: "application/pdf", disposition: nil, isMainFrame: true))
        precondition(AppPolicy.shouldDownload(mimeType: "text/html", disposition: "attachment; filename=file.html", isMainFrame: true))
        precondition(!AppPolicy.shouldDownload(mimeType: "text/html", disposition: nil, isMainFrame: true))
        precondition(!AppPolicy.shouldDownload(mimeType: "image/png", disposition: nil, isMainFrame: false))
        let filenames = [("../../secret.txt", "secret.txt"), ("C:\\temp\\report.pdf", "report.pdf"),
                         (".", "Attachment"), ("..", "Attachment"), ("", "Attachment"),
                         ("invoice\u{0}.pdf", "invoice.pdf"), ("team photo.jpg", "team photo.jpg")]
        for (input, expected) in filenames {
            precondition(AppPolicy.downloadFilename(input) == expected, "Filename: \(input)")
        }
        precondition(AppPolicy.downloadFilename(String(repeating: "📧", count: 200)).utf8.count <= 200)
        print("Passed \(destinations.count + filenames.count + 8) navigation, download, and filename checks.")
    }
}
