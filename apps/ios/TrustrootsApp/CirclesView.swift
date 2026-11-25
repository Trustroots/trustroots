import SwiftUI
import TrustrootsShared

struct CirclesView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var circles: [TrustrootsCircle] = []
    @State private var memberCircleIDs: Set<String> = []
    @State private var isLoading = false
    @State private var updatingCircleID: String?
    @State private var errorMessage: String?
    @State private var detailPath: [String] = []

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack(path: $detailPath) {
            ComposeCircles(
                circles: circles,
                memberCircleIDs: memberCircleIDs,
                isLoading: isLoading,
                updatingCircleID: updatingCircleID,
                error: errorMessage,
                serverURLString: session.serverURLString,
                onOpen: { circleID in
                    if detailPath.isEmpty { detailPath.append(circleID) }
                },
                onMembership: { circleID in
                    Task { await toggleMembership(circleID) }
                },
                onRetry: { Task { await loadCircles() } },
                onWiki: openWiki
            )
            .navigationDestination(for: String.self) { circleID in
                if let circle = circles.first(where: { $0.id == circleID }) {
                    CircleDetailView(session: session, circle: circle)
                }
            }
            .task { await loadCircles() }
        }
    }

    private func openWiki() {
        NotificationCenter.default.post(
            name: .trustrootsOpenWebsite,
            object: TrustrootsWebsiteLink(
                url: URL(string: "https://wiki.trustroots.org")!,
                title: "Trustroots Wiki"
            )
        )
    }

    private func loadCircles() async {
        guard !isLoading, updatingCircleID == nil else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let fetchedCircles = api.circles(serverURLString: session.serverURLString)
            async let memberships = api.circleMemberships(serverURLString: session.serverURLString)
            let (loadedCircles, loadedMemberships) = try await (fetchedCircles, memberships)
            if !Task.isCancelled {
                circles = loadedCircles
                memberCircleIDs = Set(loadedMemberships.map(\.tribe.id))
            }
        } catch {
            if !Task.isCancelled { errorMessage = error.localizedDescription }
        }
    }

    private func toggleMembership(_ circleID: String) async {
        guard !isLoading, updatingCircleID == nil else { return }
        let isMember = memberCircleIDs.contains(circleID)
        updatingCircleID = circleID
        errorMessage = nil
        defer { updatingCircleID = nil }

        do {
            try await api.setCircleMembership(
                serverURLString: session.serverURLString,
                circleID: circleID,
                isMember: isMember
            )
            if isMember {
                memberCircleIDs.remove(circleID)
            } else {
                memberCircleIDs.insert(circleID)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
private struct ComposeCircles: UIViewControllerRepresentable {
    let circles: [TrustrootsCircle]
    let memberCircleIDs: Set<String>
    let isLoading: Bool
    let updatingCircleID: String?
    let error: String?
    let serverURLString: String
    let onOpen: (String) -> Void
    let onMembership: (String) -> Void
    let onRetry: () -> Void
    let onWiki: () -> Void

    final class Coordinator {
        let state = MemberCirclesState()
        var onOpen: ((String) -> Void)?
        var onMembership: ((String) -> Void)?
        var onRetry: (() -> Void)?
        var onWiki: (() -> Void)?
        var circlesByID: [String: TrustrootsCircle] = [:]
        var serverURLString = ""
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MainViewControllerKt.MemberCirclesViewController(
            state: coordinator.state,
            onOpen: { [weak coordinator] id in coordinator?.onOpen?(id) },
            onMembership: { [weak coordinator] id in coordinator?.onMembership?(id) },
            onRetry: { [weak coordinator] in coordinator?.onRetry?() },
            onWiki: { [weak coordinator] in coordinator?.onWiki?() },
            createArtwork: { [weak coordinator] id in
                guard let coordinator, let circle = coordinator.circlesByID[id] else {
                    return UIViewController()
                }
                let controller = UIHostingController(rootView: CircleArtwork(
                    circle: circle,
                    serverURLString: coordinator.serverURLString
                ))
                controller.view.backgroundColor = .clear
                return controller
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onOpen = onOpen
        coordinator.onMembership = onMembership
        coordinator.onRetry = onRetry
        coordinator.onWiki = onWiki
        coordinator.circlesByID = Dictionary(uniqueKeysWithValues: circles.map { ($0.id, $0) })
        coordinator.serverURLString = serverURLString
        coordinator.state.update(
            circles: circles.map { circle in
                MemberCircle(
                    id: circle.id,
                    name: circle.label,
                    description: circle.description?.plainText ?? "",
                    memberCount: "\(circle.count.formatted()) members",
                    isMember: memberCircleIDs.contains(circle.id)
                )
            },
            isLoading: isLoading,
            updatingCircleId: updatingCircleID,
            error: error
        )
    }
}

private struct CircleArtwork: View {
    let circle: TrustrootsCircle
    let serverURLString: String

    var body: some View {
        Group {
            if circle.image,
               let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString),
               let url = URL(string: "\(configuration.normalizedURLString)/uploads-circle/\(circle.slug)/120x120.jpg") {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ProgressView()
                }
            } else {
                Text(circle.label.prefix(1).uppercased())
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(circle.color.map(Color.trustrootsHex) ?? TrustrootsPalette.green)
            }
        }
        .frame(width: 54, height: 54)
        .clipShape(Circle())
        .overlay {
            Circle().stroke(.white.opacity(0.8), lineWidth: 2)
        }
        .shadow(color: .black.opacity(0.10), radius: 4, y: 2)
    }
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }
}
