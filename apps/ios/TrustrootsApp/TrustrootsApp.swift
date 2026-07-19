import SwiftUI

@main
struct TrustrootsApp: App {
    @StateObject private var session = MemberSessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.member == nil {
                    SignInView(session: session)
                } else {
                    TrustrootsRootView(session: session)
                }
            }
            .preferredColorScheme(.light)
            .onReceive(
                NotificationCenter.default.publisher(for: .trustrootsAuthenticationRequired)
            ) { _ in
                session.invalidateSession()
            }
        }
    }
}
