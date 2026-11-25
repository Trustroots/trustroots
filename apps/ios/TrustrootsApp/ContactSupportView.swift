import SwiftUI
import TrustrootsShared

struct ContactSupportView: UIViewControllerRepresentable {
    @ObservedObject var session: MemberSessionStore
    let openFAQ: () -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        MemberSupportViewControllerKt.MemberSupportViewController(
            gateway: IOSMemberSupportGateway(session: session),
            onFaq: openFAQ
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

@MainActor
private final class IOSMemberSupportGateway: NSObject, @preconcurrency MemberSupportGateway {
    private let session: MemberSessionStore
    private let api = TrustrootsAPI()

    init(session: MemberSessionStore) {
        self.session = session
    }

    func send(message: String, completion: @escaping (String?) -> Void) {
        let server = session.serverURLString
        Task { @MainActor in
            do {
                try await api.sendSupportMessage(serverURLString: server, message: message)
                completion(nil)
            } catch {
                completion(error.localizedDescription)
            }
        }
    }
}
