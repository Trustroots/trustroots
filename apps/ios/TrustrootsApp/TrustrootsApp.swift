import SwiftUI

@main
struct TrustrootsApp: App {
    @StateObject private var session = MemberSessionStore()
    @State private var isSharedMemberPilotEnabled = Self.sharedMemberPilotLaunchArgumentEnabled

    var body: some Scene {
        WindowGroup {
            Group {
                appContent
            }
            .preferredColorScheme(.light)
            .onReceive(
                NotificationCenter.default.publisher(for: .trustrootsAuthenticationRequired)
            ) { _ in
                session.invalidateSession()
            }
        }
    }

    @ViewBuilder
    private var appContent: some View {
#if DEBUG
        if isSharedMemberPilotEnabled {
            SharedComposeHost(session: session) {
                isSharedMemberPilotEnabled = false
            }
            .id(session.member?.username.lowercased() ?? "signed-out")
            .ignoresSafeArea()
        } else {
            nativeAppContent
        }
#else
        nativeAppContent
#endif
    }

    @ViewBuilder
    private var nativeAppContent: some View {
        if session.member == nil {
            SignInView(session: session)
        } else {
            TrustrootsRootView(session: session, sharedHome: Self.sharedHomeLaunchArgumentEnabled)
        }
    }

    private static var sharedHomeLaunchArgumentEnabled: Bool {
#if DEBUG
        ProcessInfo.processInfo.arguments.contains("--shared-home")
#else
        false
#endif
    }

    private static var sharedMemberPilotLaunchArgumentEnabled: Bool {
#if DEBUG
        ProcessInfo.processInfo.arguments.contains("--shared-member-pilot")
#else
        false
#endif
    }
}
