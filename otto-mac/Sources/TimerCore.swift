import Foundation

struct TimerSite {
    let origin: URL

    init?(_ input: String) {
        guard let parts = URLComponents(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              let host = parts.host, parts.user == nil, parts.password == nil,
              parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/",
              parts.scheme == "https" || (parts.scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)),
              let url = parts.url else { return nil }
        origin = url
    }

    func owns(_ url: URL) -> Bool {
        url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
            && url.user == nil && url.password == nil
    }

    var timerURL: URL { origin.appendingPathComponent("desktop-timer") }

    func loginLink(_ input: String, authOrigin: URL?) -> URL? {
        guard let url = URL(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.user == nil, url.password == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        if owns(url), url.path == "/auth/callback",
           components.queryItems?.contains(where: { $0.name == "code" && !($0.value ?? "").isEmpty }) == true {
            return url
        }
        guard let authOrigin, url.scheme == "https", url.host == authOrigin.host,
              url.port == authOrigin.port, url.path == "/auth/v1/verify",
              let target = components.queryItems?.first(where: { $0.name == "redirect_to" })?.value,
              let redirect = URL(string: target), owns(redirect), redirect.path == "/auth/callback" else { return nil }
        return url
    }
}

struct RunningTimer {
    let sessionID: String
    let startedAt: Date
    let customer: String

    static func decode(_ body: [String: Any]) -> RunningTimer? {
        guard body["active"] as? Bool == true,
              let id = body["sessionId"] as? String, UUID(uuidString: id) != nil,
              let timestamp = body["startedAt"] as? String else { return nil }
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = format.date(from: timestamp)
        if date == nil {
            format.formatOptions = [.withInternetDateTime]
            date = format.date(from: timestamp)
        }
        guard let startedAt = date, startedAt <= Date().addingTimeInterval(5) else { return nil }
        let customer = String((body["customerName"] as? String ?? "ללא לקוח").prefix(24))
        return RunningTimer(sessionID: id, startedAt: startedAt, customer: customer)
    }

    func elapsed(at now: Date) -> String {
        let minutes = max(0, Int(now.timeIntervalSince(startedAt) / 60))
        return String(format: "%02d:%02d", minutes / 60, minutes % 60)
    }
}

struct ReminderClock {
    var sessionID: String?
    var lastReminder: Date?
    var wasIdle = false

    mutating func shouldRemind(timer: RunningTimer?, now: Date, idleSeconds: Double) -> Bool {
        guard let timer else {
            self = ReminderClock()
            return false
        }
        if sessionID != timer.sessionID {
            sessionID = timer.sessionID
            lastReminder = now
            wasIdle = false
        }
        let returning = wasIdle && idleSeconds < 10
        if idleSeconds >= 600 { wasIdle = true }
        if returning { wasIdle = false }
        let overdue = now.timeIntervalSince(lastReminder ?? now) >= 3600
        if returning || overdue {
            lastReminder = now
            return true
        }
        return false
    }
}
