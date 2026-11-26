import AuthenticationServices
import SwiftUI
import UIKit

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

            if session.requiresBrowserSignIn {
                VStack(spacing: 8) {
                    Button("Continue in browser") {
                        Task { await session.signInUsingBrowser(open: openBrowser) }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(session.isSigningIn)
                    .accessibilityIdentifier("sign-in-browser")
                    if let error = session.browserSignInError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }

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

    @MainActor
    private func openBrowser(_ url: URL) async throws -> URL {
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }?.keyWindow
        guard let window else {
            throw TrustrootsAPIError.serverMessage("Could not open browser sign-in. Please try again.")
        }
        return try await MobileSignInBrowser(anchor: window).open(url)
    }
}

@MainActor
private final class MobileSignInBrowser: NSObject, ASWebAuthenticationPresentationContextProviding {
    private let anchor: ASPresentationAnchor
    private var session: ASWebAuthenticationSession?
    private var continuation: CheckedContinuation<URL, Error>?

    init(anchor: ASPresentationAnchor) {
        self.anchor = anchor
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor
    }

    func open(_ url: URL) async throws -> URL {
        defer { session = nil }
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                guard !Task.isCancelled else {
                    finish(.failure(CancellationError()))
                    return
                }
                let browser = ASWebAuthenticationSession(
                    url: url,
                    callbackURLScheme: MobileBrowserSignIn.callbackScheme
                ) { [weak self] callback, error in
                    Task { @MainActor in
                        if let callback {
                            self?.finish(.success(callback))
                        } else if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                            self?.finish(.failure(CancellationError()))
                        } else {
                            self?.finish(.failure(TrustrootsAPIError.serverMessage(
                                "Could not complete browser sign-in. Please try again."
                            )))
                        }
                    }
                }
                browser.presentationContextProvider = self
                session = browser
                if !browser.start() {
                    finish(.failure(TrustrootsAPIError.serverMessage("Could not open browser sign-in. Please try again.")))
                }
            }
        } onCancel: { [weak self] in
            Task { @MainActor in
                self?.session?.cancel()
                self?.finish(.failure(CancellationError()))
            }
        }
    }

    private func finish(_ result: Result<URL, Error>) {
        let pending = continuation
        continuation = nil
        pending?.resume(with: result)
    }
}
