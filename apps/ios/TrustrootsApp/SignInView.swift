import SwiftUI

struct SignInView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var browserRoute: TrustrootsBrowserRoute?
    @State private var apiStatus: MobileAPIStatus?

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

                Text("API: \(serverHost)")
                    .font(.caption.monospaced())
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                    .textSelection(.enabled)
                if let apiStatus {
                    Text("API build: \(apiStatus.buildVersion)")
                        .font(.caption2.monospaced())
                }
                Text("iOS build: \(TrustrootsBuildInfo.formatted())")
                    .font(.caption2.monospaced())
                    .accessibilityLabel("iOS build time: \(TrustrootsBuildInfo.formatted())")
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

    private var serverHost: String {
        let server = session.serverURLString
        return TrustrootsAPIConfiguration(baseURLString: server)?.baseURL.host ?? server
    }
}
