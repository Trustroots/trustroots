import SwiftUI

struct CirclesView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var circles: [TrustrootsCircle] = []
    @State private var memberCircleIDs: Set<String> = []
    @State private var isLoading = false
    @State private var updatingCircleID: String?
    @State private var errorMessage: String?
    @State private var filterText = ""

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && circles.isEmpty {
                    ProgressView("Loading circles…")
                        .frame(maxHeight: .infinity)
                } else if let errorMessage {
                    ContentUnavailableView("Circles unavailable", systemImage: "person.2.badge.gearshape", description: Text(errorMessage))
                } else {
                    ScrollView {
                        VStack(spacing: 6) {
                            TextField("Filter circles", text: $filterText)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .padding(.horizontal, 8)

                            LazyVStack(spacing: 0) {
                                ForEach(filteredCircles.sorted { lhs, rhs in
                                memberCircleIDs.contains(lhs.id) && !memberCircleIDs.contains(rhs.id)
                            }) { circle in
                                NavigationLink {
                                    CircleDetailView(session: session, circle: circle)
                                } label: {
                                    CircleRow(
                                        circle: circle,
                                        serverURLString: session.serverURLString,
                                        isMember: memberCircleIDs.contains(circle.id),
                                        isUpdating: updatingCircleID == circle.id,
                                        updateMembership: { Task { await toggleMembership(circle) } }
                                    )
                                }
                                .buttonStyle(.plain)
                                Divider().padding(.leading, 76)
                        }
                            }

                            Button {
                                NotificationCenter.default.post(
                                    name: .trustrootsOpenWebsite,
                                    object: TrustrootsWebsiteLink(
                                        url: URL(string: "https://wiki.trustroots.org")!,
                                        title: "Trustroots Wiki"
                                    )
                                )
                            } label: {
                                Label("Open the Trustroots Wiki", systemImage: "book.closed")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(TrustrootsPalette.darkGreen)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                            }
                    }
                    }
                }
            }
            .task { await loadCircles() }
        }
    }

    private var filteredCircles: [TrustrootsCircle] {
        let query = filterText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return circles }
        return circles.filter { circle in
            [circle.label, circle.description?.plainText ?? ""]
                .joined(separator: " ")
                .localizedCaseInsensitiveContains(query)
        }
    }

    private func loadCircles() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let fetchedCircles = api.circles(serverURLString: session.serverURLString)
            async let memberships = api.circleMemberships(serverURLString: session.serverURLString)
            let (loadedCircles, loadedMemberships) = try await (fetchedCircles, memberships)
            circles = loadedCircles
            memberCircleIDs = Set(loadedMemberships.map(\.tribe.id))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func toggleMembership(_ circle: TrustrootsCircle) async {
        guard updatingCircleID == nil else { return }
        let isMember = memberCircleIDs.contains(circle.id)
        updatingCircleID = circle.id
        errorMessage = nil
        defer { updatingCircleID = nil }

        do {
            try await api.setCircleMembership(
                serverURLString: session.serverURLString,
                circleID: circle.id,
                isMember: isMember
            )
            if isMember {
                memberCircleIDs.remove(circle.id)
            } else {
                memberCircleIDs.insert(circle.id)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CircleRow: View {
    let circle: TrustrootsCircle
    let serverURLString: String
    let isMember: Bool
    let isUpdating: Bool
    let updateMembership: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            CircleArtwork(circle: circle, serverURLString: serverURLString)

            VStack(alignment: .leading, spacing: 2) {
                Text(circle.label)
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                if let description = circle.description?.plainText, !description.isEmpty {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Text("\(circle.count.formatted()) members")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: updateMembership) {
                if isUpdating {
                    ProgressView().controlSize(.small).frame(width: 54)
                } else {
                    Text(isMember ? "Joined" : "Join")
                        .font(.caption.weight(.semibold))
                        .frame(minWidth: 44)
                }
            }
            .buttonStyle(.bordered)
            .tint(TrustrootsPalette.darkGreen)
            .controlSize(.small)
            .disabled(isUpdating)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color(.systemBackground))
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
