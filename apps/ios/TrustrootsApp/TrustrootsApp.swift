import SwiftUI

@main
struct TrustrootsApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @UIApplicationDelegateAdaptor(NostranslationNotificationDelegate.self) private var notificationDelegate
    @StateObject private var session = MemberSessionStore()
    @ObservedObject private var translationAlerts = NostranslationDeviceAlerts.shared
    @ObservedObject private var nostrIdentity = NostrIdentityManager.shared
    @State private var showTranslationRequest = false
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
            .onChange(of: nostrIdentity.revision, initial: true) { _, _ in
                translationAlerts.reconcile(server: session.serverURLString)
                if !nostrIdentity.isActive { showTranslationRequest = false }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    translationAlerts.retryPendingOptOut(server: session.serverURLString)
                }
            }
            .onChange(of: translationAlerts.alertAccount, initial: true) { _, account in
                if let account, account == nostrIdentity.accountScope?.storageAccount, translationAlerts.enabled {
                    showTranslationRequest = true
                }
                translationAlerts.clearAlert()
            }
            .sheet(isPresented: $showTranslationRequest) {
                NostranslationSigningSheet(serverURLString: session.serverURLString, openedFromAlert: true)
            }
        }
    }

    @ViewBuilder
    private var appContent: some View {
#if DEBUG
        if isSharedMemberPilotEnabled {
            VStack(spacing: 0) {
                if session.member != nil {
                    OfflineSavedDataBanner(availability: .shared)
                }

                SharedComposeHost(session: session) {
                    isSharedMemberPilotEnabled = false
                }
                .id(session.member?.username.lowercased() ?? "signed-out")
                .ignoresSafeArea()
            }
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
