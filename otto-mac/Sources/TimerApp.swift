import AppKit
import WebKit
import CoreGraphics

@MainActor
final class TimerApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var status: NSStatusItem!
    private var window: NSWindow!
    private var web: WKWebView!
    private var site: TimerSite!
    private var authOrigin: URL?
    private var timer: RunningTimer?
    private var syncedAt: Date?
    private var clock = ReminderClock()
    private var heartbeat: Timer?
    private var banner: NSTextField!
    private var reminderPending = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        let args = ProcessInfo.processInfo.arguments
        let argumentURL = args.firstIndex(of: "--url").flatMap { index in
            index + 1 < args.count ? args[index + 1] : nil
        }
        let configured = argumentURL ?? UserDefaults.standard.string(forKey: "OTTOBaseURL") ?? "http://localhost:3000"
        site = TimerSite(configured) ?? TimerSite("http://localhost:3000")!
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        let quitItem = NSMenuItem(title: "יציאה", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        appMenu.addItem(quitItem)
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let edit = NSMenuItem(title: "עריכה", action: nil, keyEquivalent: "")
        let editMenu = NSMenu(title: "עריכה")
        for (title, selector, key) in [("גזירה", "cut:", "x"), ("העתקה", "copy:", "c"), ("הדבקה", "paste:", "v"), ("בחר הכל", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        edit.submenu = editMenu
        menu.addItem(edit)
        NSApp.mainMenu = menu
        makeWindow()
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        status.button?.title = "OTTO"
        status.button?.target = self
        status.button?.action = #selector(toggleWindow)
        status.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        status.button?.toolTip = "טיימר OTTO - לחיצה לפתיחה, לחיצה ימנית לתפריט"
        heartbeat = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(didWake),
            name: NSWorkspace.didWakeNotification, object: nil)
        web.load(URLRequest(url: site.timerURL))
        showWindow()
    }

    private func makeWindow() {
        let content = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 680))
        window = NSWindow(contentRect: content.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.title = "OTTO - דיווח שעות"
        window.minSize = NSSize(width: 380, height: 500)
        window.isReleasedWhenClosed = false
        window.contentView = content
        window.center()

        let toolbar = NSStackView()
        toolbar.orientation = .horizontal
        toolbar.spacing = 8
        toolbar.addArrangedSubview(button("טעינה מחדש", #selector(reload)))
        toolbar.addArrangedSubview(button("קישור כניסה", #selector(pasteLoginLink)))
        toolbar.addArrangedSubview(button("הגדרות", #selector(settings)))
        banner = NSTextField(wrappingLabelWithString: "")
        banner.font = .systemFont(ofSize: 12)
        banner.textColor = .secondaryLabelColor
        banner.alignment = .right

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "ottoTimer")
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.customUserAgent = nil
        for view in [toolbar, banner!, web!] as [NSView] {
            view.translatesAutoresizingMaskIntoConstraints = false
            content.addSubview(view)
        }
        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: content.topAnchor, constant: 10),
            toolbar.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            banner.topAnchor.constraint(equalTo: toolbar.bottomAnchor, constant: 8),
            banner.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 12),
            banner.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -12),
            web.topAnchor.constraint(equalTo: banner.bottomAnchor, constant: 8),
            web.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: content.bottomAnchor)
        ])
    }

    private func button(_ title: String, _ action: Selector) -> NSButton {
        let button = NSButton(title: title, target: self, action: action)
        button.bezelStyle = .rounded
        return button
    }

    @objc private func toggleWindow() {
        if NSApp.currentEvent?.type == .rightMouseUp {
            let menu = NSMenu()
            for (title, action) in [("פתח טיימר", #selector(showWindow)), ("הגדרות", #selector(settings)), ("יציאה", #selector(quit))] {
                let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
                item.target = self
                menu.addItem(item)
            }
            status.menu = menu
            status.button?.performClick(nil)
            status.menu = nil
        } else if window.isVisible && window.isKeyWindow {
            window.orderOut(nil)
        } else { showWindow() }
    }

    @objc private func showWindow() {
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    @objc private func reload() {
        let alert = NSAlert()
        alert.messageText = "לטעון מחדש את הטיימר?"
        alert.informativeText = "שינויים שעדיין לא נשמרו עלולים להיעלם. הדיווח הפעיל בשרת ימשיך לרוץ."
        alert.addButton(withTitle: "טען מחדש")
        alert.addButton(withTitle: "חזור")
        if alert.runModal() == .alertFirstButtonReturn { web.load(URLRequest(url: site.timerURL)) }
    }

    @objc private func pasteLoginLink() {
        let alert = NSAlert()
        alert.messageText = "קישור הכניסה מהמייל"
        alert.informativeText = "הדבק את קישור הכניסה שביקשת מתוך הטיימר. הקישור משמש רק לכניסה ואינו נשמר בהגדרות."
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 360, height: 24))
        input.placeholderString = "https://..."
        alert.accessoryView = input
        alert.addButton(withTitle: "כניסה")
        alert.addButton(withTitle: "ביטול")
        alert.window.initialFirstResponder = input
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        guard let url = site.loginLink(input.stringValue, authOrigin: authOrigin) else {
            banner.stringValue = "הקישור אינו קישור כניסה למערכת הזו. בקש קישור חדש מתוך הטיימר."
            return
        }
        input.stringValue = ""
        web.load(URLRequest(url: url))
    }

    @objc private func settings() {
        let alert = NSAlert()
        alert.messageText = "כתובת מערכת OTTO"
        alert.informativeText = "כתובת האתר בלבד. שינוי כתובת פותח מערכת אחרת; טיימר שכבר רץ לא ייעצר."
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 360, height: 24))
        input.stringValue = site.origin.absoluteString
        alert.accessoryView = input
        alert.addButton(withTitle: "שמירה ופתיחה")
        alert.addButton(withTitle: "ביטול")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        guard let next = TimerSite(input.stringValue) else {
            banner.stringValue = "יש להזין כתובת HTTPS תקינה, ללא נתיב. לפיתוח מקומי אפשר localhost."
            return
        }
        site = next
        authOrigin = nil
        timer = nil
        syncedAt = nil
        clock = ReminderClock()
        UserDefaults.standard.set(next.origin.absoluteString, forKey: "OTTOBaseURL")
        web.load(URLRequest(url: next.timerURL))
        showWindow()
    }

    @objc private func quit() {
        let alert = NSAlert()
        alert.messageText = "לסגור את OTTO למק?"
        alert.informativeText = "סגירת האפליקציה אינה עוצרת דיווח פעיל. לא יוצגו תזכורות עד שתפתח אותה שוב."
        alert.addButton(withTitle: "צא")
        alert.addButton(withTitle: "חזור לטיימר")
        if alert.runModal() == .alertFirstButtonReturn { NSApp.terminate(nil) }
    }

    @objc private func didWake() {
        if timer != nil { remind() }
    }

    private func tick() {
        let now = Date()
        let stale = syncedAt.map { now.timeIntervalSince($0) > 60 } ?? true
        if let timer {
            status.button?.title = "\(stale ? "?" : "●") \(timer.elapsed(at: now)) · \(timer.customer)"
        } else { status.button?.title = stale ? "OTTO ?" : "OTTO" }
        status.button?.contentTintColor = reminderPending ? .systemOrange : nil
        let anyInput = CGEventType(rawValue: UInt32.max)!
        let idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: anyInput)
        if clock.shouldRemind(timer: timer, now: now, idleSeconds: idle) { remind() }
    }

    private func remind() {
        reminderPending = true
        banner.stringValue = "הטיימר עדיין פעיל. בדוק אם צריך לעצור או לתקן את שעת הסיום."
        web.evaluateJavaScript("window.dispatchEvent(new Event('otto:reminder'))", completionHandler: nil)
        showWindow()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let frameURL = message.frameInfo.request.url, site.owns(frameURL),
              let body = message.body as? [String: Any] else { return }
        let pagePath = frameURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if body["type"] as? String == "reminder-ack", pagePath == "desktop-timer" {
            reminderPending = false
            banner.stringValue = ""
            tick()
            return
        }
        if body["type"] as? String == "auth", pagePath == "desktop-timer/login" {
            if let value = body["authOrigin"] as? String,
               let url = URL(string: value), url.scheme == "https", url.host != nil,
               url.user == nil, url.password == nil { authOrigin = url }
            timer = nil
            syncedAt = nil
            return
        }
        guard pagePath == "desktop-timer", let active = body["active"] as? Bool else { return }
        let decoded = RunningTimer.decode(body)
        guard !active || decoded != nil else { return }
        timer = decoded
        syncedAt = Date()
        if !active {
            reminderPending = false
            banner.stringValue = ""
        }
        tick()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if site.owns(url) {
            if url.path == "/dashboard" || url.path == "/login" {
                decisionHandler(.cancel)
                let path = url.path == "/login" ? "desktop-timer/login" : "desktop-timer"
                webView.load(URLRequest(url: site.origin.appendingPathComponent(path)))
                return
            }
            decisionHandler(.allow)
        } else if site.loginLink(url.absoluteString, authOrigin: authOrigin) != nil {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            banner.stringValue = "הטיימר מאפשר ניווט רק בתוך מערכת OTTO."
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if !reminderPending { banner.stringValue = "" }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard let url = frame.request.url, frame.isMainFrame, site.owns(url) else {
            completionHandler(false)
            return
        }
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "אישור")
        alert.addButton(withTitle: "חזרה")
        showWindow()
        alert.beginSheetModal(for: window) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        banner.stringValue = "לא ניתן להתחבר למערכת. בדוק חיבור וכתובת בהגדרות, ואז טען מחדש."
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        banner.stringValue = "חלון הטיימר נסגר באופן לא צפוי. טען מחדש כדי לבדוק את הדיווח בשרת."
        syncedAt = nil
    }
}
