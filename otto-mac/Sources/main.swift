import AppKit

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = TimerApp()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
}
