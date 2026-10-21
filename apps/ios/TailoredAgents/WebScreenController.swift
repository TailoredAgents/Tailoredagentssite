import UIKit
import WebKit

final class WebScreenController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let appTab: AppTab
    var openTab: ((AppTab, URLRequest) -> Void)?
    private(set) var webView: WKWebView!
    private var observations: [NSKeyValueObservation] = []
    private var keyboardObservers: [NSObjectProtocol] = []
    private var pageMenuButton: UIBarButtonItem!
    private lazy var doneButton = UIBarButtonItem(title: "Done", style: .done,
                                                  target: self, action: #selector(hideKeyboard))
    private let progress = UIProgressView(progressViewStyle: .bar)
    private let errorPanel = UIStackView()
    private let errorMessage = UILabel()
    private var pendingRequest: URLRequest?
    private var downloads: [ObjectIdentifier: WKDownload] = [:]
    private var destinations: [ObjectIdentifier: URL] = [:]
    private var pendingAttachments: [URL] = []
    private lazy var backButton = UIBarButtonItem(image: UIImage(systemName: "chevron.left"),
                                                  style: .plain, target: self, action: #selector(goBack))

    init(tab: AppTab) {
        self.appTab = tab
        super.init(nibName: nil, bundle: nil)
        title = tab.title
    }

    required init?(coder: NSCoder) { fatalError("Use init(tab:)") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let configuration = WKWebViewConfiguration()
        // WebKit retains secure session cookies; native code never reads passwords.
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "TailoredAgents-iOS/1.0"
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        view.addSubview(webView)
        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.accessibilityLabel = "Loading \(appTab.title)"
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            progress.topAnchor.constraint(equalTo: webView.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        configureErrorPanel()
        backButton.accessibilityLabel = "Back"
        navigationItem.leftBarButtonItem = backButton
        let menu = UIMenu(children: [
            UIAction(title: "Reload", image: UIImage(systemName: "arrow.clockwise")) { [weak self] _ in self?.requestReload() },
            UIAction(title: "Open in Safari", image: UIImage(systemName: "safari")) { [weak self] _ in
                guard let self else { return }
                self.openExternal(self.webView.url ?? self.appTab.homeURL)
            }
        ])
        pageMenuButton = UIBarButtonItem(image: UIImage(systemName: "ellipsis.circle"), menu: menu)
        pageMenuButton.accessibilityLabel = "Page options"
        navigationItem.rightBarButtonItems = [pageMenuButton]
        doneButton.accessibilityLabel = "Hide keyboard"
        keyboardObservers = [
            NotificationCenter.default.addObserver(forName: UIResponder.keyboardWillShowNotification,
                                                   object: nil, queue: .main) { [weak self] _ in
                guard let self, self.view.window != nil else { return }
                self.navigationItem.rightBarButtonItems = [self.doneButton, self.pageMenuButton]
            },
            NotificationCenter.default.addObserver(forName: UIResponder.keyboardWillHideNotification,
                                                   object: nil, queue: .main) { [weak self] _ in
                guard let self else { return }
                self.navigationItem.rightBarButtonItems = [self.pageMenuButton]
            }
        ]
        observations = [
            webView.observe(\.estimatedProgress, options: [.initial, .new]) { [weak self] webView, _ in
                self?.progress.progress = Float(webView.estimatedProgress)
            },
            webView.observe(\.isLoading, options: [.initial, .new]) { [weak self] webView, _ in
                self?.progress.isHidden = !webView.isLoading
            },
            webView.observe(\.canGoBack, options: [.initial, .new]) { [weak self] webView, _ in
                self?.backButton.isEnabled = webView.canGoBack
            }
        ]
        let request = pendingRequest ?? URLRequest(url: appTab.homeURL)
        pendingRequest = nil
        webView.load(request)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        shareNextAttachment()
    }

    deinit { keyboardObservers.forEach(NotificationCenter.default.removeObserver) }

    func open(_ request: URLRequest) {
        if !isViewLoaded { pendingRequest = request; return }
        errorPanel.isHidden = true
        webView.load(request)
    }

    private func configureErrorPanel() {
        errorPanel.axis = .vertical
        errorPanel.spacing = 16
        errorPanel.alignment = .center
        errorPanel.translatesAutoresizingMaskIntoConstraints = false
        errorPanel.backgroundColor = .systemBackground
        errorPanel.isLayoutMarginsRelativeArrangement = true
        errorPanel.layoutMargins = UIEdgeInsets(top: 24, left: 24, bottom: 24, right: 24)
        errorPanel.layer.cornerRadius = 16
        errorMessage.font = .preferredFont(forTextStyle: .body)
        errorMessage.adjustsFontForContentSizeCategory = true
        errorMessage.numberOfLines = 0
        errorMessage.textAlignment = .center
        let retry = UIButton(type: .system)
        retry.configuration = .borderedProminent()
        retry.setTitle("Try again", for: .normal)
        retry.addTarget(self, action: #selector(reloadPage), for: .touchUpInside)
        errorPanel.addArrangedSubview(errorMessage)
        errorPanel.addArrangedSubview(retry)
        view.addSubview(errorPanel)
        NSLayoutConstraint.activate([
            errorPanel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            errorPanel.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
            errorPanel.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -40)
        ])
        errorPanel.isHidden = true
    }

    @objc private func goBack() { webView.goBack() }
    @objc private func hideKeyboard() { view.endEditing(true) }
    @objc private func reloadPage() {
        errorPanel.isHidden = true
        if webView.url == nil { webView.load(URLRequest(url: appTab.homeURL)) }
        else { webView.reload() }
    }

    private func requestReload() {
        if appTab == .mail, let path = webView.url?.path, path == "/compose" || path.hasPrefix("/mail/") {
            let alert = UIAlertController(title: "Reload Mail?", message: "If you are writing a message, check that your draft says Saved before reloading.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
            alert.addAction(UIAlertAction(title: "Reload", style: .default) { [weak self] _ in self?.reloadPage() })
            present(alert, animated: true)
        } else { reloadPage() }
    }

    private func showError(_ message: String) {
        errorMessage.text = message
        errorPanel.isHidden = false
        progress.isHidden = true
    }

    private func showNotice(_ title: String, message: String) {
        guard presentedViewController == nil, view.window != nil else { return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private func openExternal(_ url: URL) {
        UIApplication.shared.open(url, options: [:]) { [weak self] opened in
            if !opened { self?.showNotice("Couldn’t open link", message: "No available app can open this link.") }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(AppPolicy.allowsSubframe(url) ? .allow : .cancel)
            return
        }
        switch AppPolicy.destination(for: url, source: appTab) {
        case .tab(let target):
            if target != appTab || navigationAction.targetFrame == nil {
                decisionHandler(.cancel)
                guard navigationAction.request.httpMethod == nil || navigationAction.request.httpMethod == "GET" else { return }
                if target == appTab { open(navigationAction.request) }
                else { openTab?(target, navigationAction.request) }
            } else {
                decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
            }
        case .attachment:
            decisionHandler(.download)
        case .browser:
            decisionHandler(.cancel)
            openExternal(url)
        case .googleConnection:
            decisionHandler(.cancel)
            let alert = UIAlertController(title: "Connect Google in Safari", message: "Sign in to the dashboard in Safari and connect Google there. Then return to this app and reload Dashboard.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
            alert.addAction(UIAlertAction(title: "Open Safari", style: .default) { [weak self] _ in
                self?.openExternal(URL(string: "https://www.tailoredagents.com/dashboard/analytics")!)
            })
            if presentedViewController == nil { present(alert, animated: true) }
        case .blocked:
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let response = navigationResponse.response
        let http = response as? HTTPURLResponse
        if navigationResponse.isForMainFrame, let status = http?.statusCode, status >= 500 {
            decisionHandler(.cancel)
            showError("\(appTab.title) is temporarily unavailable. Please try again shortly.")
            return
        }
        let shouldDownload = AppPolicy.shouldDownload(mimeType: response.mimeType,
            disposition: http?.value(forHTTPHeaderField: "Content-Disposition"),
            isMainFrame: navigationResponse.isForMainFrame)
        decisionHandler(shouldDownload || !navigationResponse.canShowMIMEType ? .download : .allow)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        errorPanel.isHidden = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        navigationFailed(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        navigationFailed(error)
    }

    private func navigationFailed(_ error: Error) {
        let error = error as NSError
        if error.code == NSURLErrorCancelled || (error.domain == "WebKitErrorDomain" && error.code == 102) { return }
        showError("Couldn’t load \(appTab.title). Check your internet connection and try again.")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showError("\(appTab.title) needs to reload. Your saved work will be available when you reconnect.")
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // New-window navigation is handled in the navigation policy above.
        nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard canShowDialog(frame) else { completionHandler(); return }
        let alert = UIAlertController(title: appTab.title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard canShowDialog(frame) else { completionHandler(false); return }
        let alert = UIAlertController(title: appTab.title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        guard canShowDialog(frame) else { completionHandler(nil); return }
        let alert = UIAlertController(title: appTab.title, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text) })
        present(alert, animated: true)
    }

    private func canShowDialog(_ frame: WKFrameInfo) -> Bool {
        frame.isMainFrame && frame.request.url.flatMap(AppPolicy.tab(for:)) == appTab && presentedViewController == nil && view.window != nil
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { track(download) }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { track(download) }

    private func track(_ download: WKDownload) {
        downloads[ObjectIdentifier(download)] = download
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        do {
            let url = try AttachmentStore.destination(for: suggestedFilename)
            destinations[ObjectIdentifier(download)] = url
            completionHandler(url)
        } catch {
            completionHandler(nil)
            showNotice("Couldn’t save attachment", message: "Check your iPhone’s available storage and try again.")
        }
    }

    func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, decisionHandler: @escaping (WKDownload.RedirectPolicy) -> Void) {
        decisionHandler(request.url.flatMap(AppPolicy.tab(for:)) == appTab ? .allow : .cancel)
    }

    func downloadDidFinish(_ download: WKDownload) {
        let key = ObjectIdentifier(download)
        downloads.removeValue(forKey: key)
        guard let url = destinations.removeValue(forKey: key) else { return }
        pendingAttachments.append(url)
        shareNextAttachment()
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        let key = ObjectIdentifier(download)
        downloads.removeValue(forKey: key)
        if let url = destinations.removeValue(forKey: key) { AttachmentStore.remove(url) }
        showNotice("Download failed", message: "Check your connection and try opening the attachment again.")
    }

    private func shareNextAttachment() {
        guard view.window != nil, presentedViewController == nil, !pendingAttachments.isEmpty else { return }
        let url = pendingAttachments.removeFirst()
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        share.popoverPresentationController?.barButtonItem = navigationItem.rightBarButtonItem
        share.completionWithItemsHandler = { [weak self] _, _, _, _ in
            AttachmentStore.remove(url)
            DispatchQueue.main.async { self?.shareNextAttachment() }
        }
        present(share, animated: true)
    }
}
