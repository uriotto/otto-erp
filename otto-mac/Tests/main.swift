import Foundation

func check(_ condition: @autoclosure () -> Bool, _ description: String) {
    precondition(condition(), description)
}

let site = TimerSite("https://otto.example")!
check(TimerSite("http://otto.example") == nil, "Reject remote plain HTTP")
check(TimerSite("https://user:secret@otto.example") == nil, "Reject credentials")
check(TimerSite("https://otto.example/path") == nil, "Reject paths")
check(TimerSite("http://localhost:3000") != nil, "Allow local development")
check(!site.owns(URL(string: "https://otto.example.evil.test")!), "Origin boundary")
check(site.loginLink("https://evil.test/auth/callback?code=sample", authOrigin: nil) == nil, "Reject foreign login")
check(site.loginLink("https://otto.example/auth/callback?code=sample", authOrigin: nil) != nil, "Allow same origin callback")
let auth = URL(string: "https://auth.example")!
check(site.loginLink("https://auth.example/auth/v1/verify?token=sample&redirect_to=https%3A%2F%2Fevil.test%2Fauth%2Fcallback", authOrigin: auth) == nil, "Reject foreign redirect")
check(site.loginLink("https://auth.example/auth/v1/verify?token=sample&redirect_to=https%3A%2F%2Fotto.example%2Fauth%2Fcallback", authOrigin: auth) != nil, "Allow expected email verification")

let now = Date()
let running = RunningTimer(sessionID: UUID().uuidString, startedAt: now.addingTimeInterval(-600), customer: "Test")
check(running.elapsed(at: now) == "00:10", "Elapsed time")
var clock = ReminderClock()
check(!clock.shouldRemind(timer: running, now: now, idleSeconds: 0), "No immediate interruption")
check(!clock.shouldRemind(timer: running, now: now.addingTimeInterval(601), idleSeconds: 601), "Wait until return from idle")
check(clock.shouldRemind(timer: running, now: now.addingTimeInterval(610), idleSeconds: 1), "Remind after idle return")
check(!clock.shouldRemind(timer: running, now: now.addingTimeInterval(615), idleSeconds: 1), "Do not repeat every tick")
check(clock.shouldRemind(timer: running, now: now.addingTimeInterval(4210), idleSeconds: 0), "Hourly reminder")
check(!clock.shouldRemind(timer: nil, now: now.addingTimeInterval(4215), idleSeconds: 0), "No stopped timer reminder")
print("PASS: native URL boundaries, timer clock, idle return and hourly reminders")
