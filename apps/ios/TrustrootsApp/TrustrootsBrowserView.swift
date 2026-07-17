import SwiftUI
import UIKit
import WebKit

enum TrustrootsBrowserRoute: Identifiable {
    case join
    case confirmation
    case passwordRecovery
    case website(path: String, title: String)

    var id: String {
        switch self {
        case .join: return "/signup"
        case .confirmation: return "/confirm-email"
        case .passwordRecovery: return "/password/forgot"
        case .website(let path, _): return path
        }
    }

    var title: String {
        switch self {
        case .join:
            return "Join Trustroots"
        case .confirmation:
            return "Confirm email"
        case .passwordRecovery:
            return "Reset password"
        case .website(_, let title):
            return title
        }
    }

    var url: URL {
        switch self {
        case .join:
            return URL(string: "https://www.trustroots.org/signup")!
        case .confirmation:
            return URL(string: "https://www.trustroots.org/confirm-email")!
        case .passwordRecovery:
            return URL(string: "https://www.trustroots.org/password/forgot")!
        case .website(let path, _):
            if let absoluteURL = URL(string: path), absoluteURL.scheme != nil {
                return absoluteURL
            }
            return URL(string: "https://www.trustroots.org\(path)")!
        }
    }
}

struct TrustrootsBrowserView: View {
    let route: TrustrootsBrowserRoute
    let onClose: () -> Void
    @State private var externalURL: URL?
    @State private var nip07PermissionPrompt: NIP07PermissionPrompt?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onClose) {
                    Label("Back", systemImage: "chevron.backward")
                        .font(.subheadline.weight(.semibold))
                }
                Spacer()
                Text(route.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Color.clear.frame(width: 58, height: 1)
            }
            .padding(.horizontal)
            .frame(height: 48)
            .background(.bar)

            TrustrootsWebView(
                url: route.url,
                externalURL: $externalURL,
                nip07PermissionPrompt: $nip07PermissionPrompt
            )
        }
        .alert(
            "Open external website?",
            isPresented: Binding(
                get: { externalURL != nil },
                set: { if !$0 { externalURL = nil } }
            ),
            presenting: externalURL
        ) { url in
            Button("Open") {
                UIApplication.shared.open(url)
                externalURL = nil
            }
            Button("Cancel", role: .cancel) {
                externalURL = nil
            }
        } message: { url in
            Text(url.host ?? url.absoluteString)
        }
        .sheet(item: $nip07PermissionPrompt) { prompt in
            NIP07PermissionView(prompt: prompt)
                .presentationDetents([.height(300)])
                .presentationDragIndicator(.visible)
                .interactiveDismissDisabled()
        }
    }
}

struct TrustrootsWebView: UIViewRepresentable {
    let url: URL
    @Binding var externalURL: URL?
    @Binding var nip07PermissionPrompt: NIP07PermissionPrompt?

    func makeCoordinator() -> Coordinator {
        Coordinator(externalURL: $externalURL, nip07PermissionPrompt: $nip07PermissionPrompt)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.addUserScript(WKUserScript(
            source: NIP07Bridge.injectedScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        contentController.add(context.coordinator, name: NIP07Bridge.scriptHandlerName)
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.applicationNameForUserAgent = "TrustrootsiOS/0.1 native"
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.webView = webView
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        weak var webView: WKWebView?
        @Binding private var externalURL: URL?
        @Binding private var nip07PermissionPrompt: NIP07PermissionPrompt?
        private var pendingNIP07Messages: [String: [(id: String, method: String, params: Any?)]] = [:]

        init(
            externalURL: Binding<URL?>,
            nip07PermissionPrompt: Binding<NIP07PermissionPrompt?>
        ) {
            _externalURL = externalURL
            _nip07PermissionPrompt = nip07PermissionPrompt
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == NIP07Bridge.scriptHandlerName,
                  let metadata = NIP07Bridge.metadata(from: message.body) else { return }
            let frameURL = message.frameInfo.request.url
            guard message.frameInfo.isMainFrame else {
                send(NIP07Bridge.response(
                    id: metadata.id,
                    error: "Nostr key access is available only to the main page."
                ))
                return
            }

            Task { @MainActor in
                guard NIP07Bridge.supportedMethods.contains(metadata.method),
                      let origin = NIP07Bridge.trustedOrigin(for: frameURL) else {
                    self.send(NIP07Bridge.response(id: metadata.id, error: "Nostr key access is not available for this website."))
                    return
                }

                if NIP07Bridge.isAutomaticallyAllowed(origin) ||
                    NIP07PermissionStore.shared.isAllowed(origin) {
                    self.perform(metadata)
                    return
                }

                self.pendingNIP07Messages[origin, default: []].append(metadata)
                guard self.pendingNIP07Messages[origin]?.count == 1 else { return }
                let host = URL(string: origin)?.host ?? origin
                self.nip07PermissionPrompt = NIP07PermissionPrompt(
                    host: host,
                    allow: { [weak self] remember in
                        guard let self else { return }
                        if remember { NIP07PermissionStore.shared.allow(origin) }
                        self.performPending(origin: origin)
                    },
                    deny: { [weak self] in
                        guard let self else { return }
                        self.denyPending(origin: origin)
                    }
                )
            }
        }

        private func performPending(origin: String) {
            let messages = pendingNIP07Messages.removeValue(forKey: origin) ?? []
            guard NIP07Bridge.trustedOrigin(for: webView?.url) == origin else {
                messages.forEach {
                    send(NIP07Bridge.response(
                        id: $0.id,
                        error: "The page changed before Nostr access was approved."
                    ))
                }
                return
            }
            messages.forEach(perform)
        }

        private func denyPending(origin: String) {
            let messages = pendingNIP07Messages.removeValue(forKey: origin) ?? []
            for message in messages {
                send(NIP07Bridge.response(id: message.id, error: "Nostr key access was not allowed."))
            }
        }

        @MainActor
        private func perform(_ metadata: (id: String, method: String, params: Any?)) {
            send(NIP07Bridge.handle(
                id: metadata.id,
                method: metadata.method,
                params: metadata.params,
                identity: .shared
            ))
        }

        private func send(_ response: [String: Any]) {
            guard let data = try? JSONSerialization.data(withJSONObject: response),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.__trustrootsNip7Receive(\(json));")
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            guard url.scheme?.lowercased() == "https" else {
                externalURL = url
                decisionHandler(.cancel)
                return
            }

            guard Self.isTrustrootsURL(url) else {
                externalURL = url
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard navigationAction.targetFrame == nil,
                  let url = navigationAction.request.url else {
                return nil
            }
            if Self.isTrustrootsURL(url) {
                webView.load(URLRequest(url: url))
            } else {
                externalURL = url
            }
            return nil
        }

        static func isTrustrootsURL(_ url: URL) -> Bool {
            guard let host = url.host?.lowercased() else { return false }
            return NIP07Bridge.isTrustedHost(host)
        }
    }
}

private struct NIP07PermissionView: View {
    @Environment(\.dismiss) private var dismiss
    let prompt: NIP07PermissionPrompt
    @State private var remember = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Allow Nostr key access?")
                .font(.title3.bold())
            Text("\(prompt.host) wants to use your Nostr key. Your private key stays on this device.")
                .foregroundStyle(.secondary)
            Toggle("Remember this website", isOn: $remember)
                .tint(TrustrootsPalette.green)
            HStack {
                Button("Don’t allow") {
                    prompt.deny()
                    dismiss()
                }
                .buttonStyle(.bordered)
                Spacer()
                Button("Allow") {
                    prompt.allow(remember)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .tint(TrustrootsPalette.green)
            }
        }
        .padding(22)
    }
}
