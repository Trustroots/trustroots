import SwiftUI

struct SignInView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var browserRoute: TrustrootsBrowserRoute?
    @State private var apiStatus: MobileAPIStatus?
    @ScaledMetric(relativeTo: .caption2) private var buildInfoSize: CGFloat = 8

    private let api = TrustrootsAPI()

    var body: some View {
        VStack(spacing: 0) {
            SharedSignInController(session: session) {
                browserRoute = .join
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            VStack(spacing: 5) {
#if DEBUG && targetEnvironment(simulator)
                Picker("API server", selection: $session.serverURLString) {
                    Text("Local API")
                        .tag(TrustrootsAPIConfiguration.localDefaultURLString)
                    Text("Live Trustroots")
                        .tag(TrustrootsAPIConfiguration.productionURLString)
                }
                .pickerStyle(.segmented)
                .disabled(session.isSigningIn)
#endif

                VStack(spacing: 2) {
                    if let apiStatus {
                        Text("API build: \(apiStatus.buildVersion)")
                    }
                    Text("iOS build: \(TrustrootsBuildInfo.formatted())")
                        .accessibilityLabel("iOS build time: \(TrustrootsBuildInfo.formatted())")
                        .accessibilityIdentifier("sign-in-ios-build")
                }
                .font(.system(size: buildInfoSize, design: .monospaced))
            }
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .fullScreenCover(item: $browserRoute) { route in
            TrustrootsBrowserView(route: route) {
                browserRoute = nil
            }
        }
        .task(id: session.serverURLString) {
            apiStatus = nil
            let status = try? await api.status(serverURLString: session.serverURLString)
            if !Task.isCancelled { apiStatus = status }
        }
    }
}
