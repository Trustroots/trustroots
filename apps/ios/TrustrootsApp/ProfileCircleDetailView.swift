import SwiftUI

struct ProfileCircleDetailView: View {
    @ObservedObject var session: MemberSessionStore
    let circle: ProfileCircle
    @State private var resolvedCircle: TrustrootsCircle?
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        Group {
            if let resolvedCircle {
                CircleDetailView(session: session, circle: resolvedCircle)
            } else if let errorMessage {
                ContentUnavailableView(
                    "Circle unavailable",
                    systemImage: "person.2",
                    description: Text(errorMessage)
                )
            } else {
                ProgressView("Loading \(circle.label)…")
            }
        }
        .task { await resolveCircle() }
    }

    private func resolveCircle() async {
        do {
            let circles = try await api.circles(serverURLString: session.serverURLString)
            resolvedCircle = circles.first { $0.id == circle.id }
            if resolvedCircle == nil { errorMessage = "This circle could not be found." }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
