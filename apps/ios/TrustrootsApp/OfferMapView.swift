import MapKit
import SwiftUI

struct OfferMapView: View {
    @ObservedObject var session: MemberSessionStore
    let searchLocation: String?
    @State private var position = MapCameraPosition.region(.initialTrustrootsRegion)
    @State private var visibleRegion = MKCoordinateRegion.initialTrustrootsRegion
    @State private var offers: [MapOffer] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedHost: HostOffer?
    @State private var isLoadingHost = false
    @State private var showingFilters = false
    @State private var showingHosts = true
    @State private var showingCommunityNotes = true
    @State private var circles: [TrustrootsCircle] = []
    @State private var selectedCircleIDs: Set<String> = []
    @State private var searchGeneration = 0
    @StateObject private var currentLocation = CurrentLocationManager()
    @StateObject private var communityNotes = CommunityNotesStore()
    @State private var selectedCommunityNote: CommunityNote?

    private let api = TrustrootsAPI()

    private var clusters: [HostCluster] {
        HostCluster.group(offers, in: visibleRegion)
    }

    var body: some View {
        NavigationStack {
            Map(position: $position) {
                ForEach(clusters) { cluster in
                    Annotation("", coordinate: cluster.coordinate) {
                        Button {
                            Task { await select(cluster) }
                        } label: {
                            HostMapDot(count: cluster.count, color: cluster.color)
                        }
                        .accessibilityLabel(cluster.count == 1 ? "View potential host" : "View \(cluster.count) potential hosts")
                    }
                }
                if showingCommunityNotes {
                    ForEach(CommunityNoteCluster.group(communityNotes.notes, in: visibleRegion)) { cluster in
                        Annotation("", coordinate: cluster.coordinate) {
                            Button {
                                if cluster.notes.count > 1 {
                                    position = .region(cluster.zoomedRegion(from: visibleRegion))
                                } else {
                                    selectedHost = nil
                                    selectedCommunityNote = cluster.notes.first
                                }
                            } label: {
                                HostMapDot(count: cluster.notes.count, color: TrustrootsPalette.communityNote)
                            }
                            .accessibilityLabel(cluster.notes.count == 1 ? "View Community Note" : "View \(cluster.notes.count) Community Notes")
                        }
                    }
                }
            }
            .mapStyle(.standard(elevation: .realistic))
            .onMapCameraChange(frequency: .onEnd) { context in
                visibleRegion = context.region
                Task { await loadOffers(in: context.region) }
            }
            .overlay(alignment: .topTrailing) {
                VStack(alignment: .trailing, spacing: 8) {
                    if isLoading || !offers.isEmpty {
                        HStack(spacing: 6) {
                            if isLoading {
                                ProgressView()
                                    .controlSize(.small)
                            } else {
                                Circle()
                                    .fill(resultCountColor)
                                    .frame(width: 9, height: 9)
                            }
                            Text(isLoading ? "Searching this area…" : resultCountLabel)
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 8)
                        .background(.regularMaterial)
                        .clipShape(Capsule())
                        .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
                    }
                    if !isLoading && !offers.isEmpty {
                        MapOfferLegend(
                            showingHosts: showingHosts,
                            showingCommunityNotes: showingCommunityNotes
                        )
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.white)
                            .padding(10)
                            .background(.red.opacity(0.9))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                .padding(.top, 5)
                .padding(.trailing, 12)
            }
            .overlay(alignment: .topLeading) {
                VStack(spacing: 8) {
                    Button {
                        showingFilters = true
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(TrustrootsPalette.darkGreen)
                            .padding(9)
                            .background(TrustrootsPalette.paleGreen.opacity(0.96))
                            .clipShape(Circle())
                            .shadow(color: .black.opacity(0.14), radius: 3, y: 1)
                    }
                    .accessibilityLabel("Search filters")

                    Button {
                        currentLocation.useCurrentLocation()
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(TrustrootsPalette.darkGreen)
                            .padding(9)
                            .background(TrustrootsPalette.paleGreen.opacity(0.96))
                            .clipShape(Circle())
                            .shadow(color: .black.opacity(0.14), radius: 3, y: 1)
                    }
                    .accessibilityLabel("Use current location")
                }
                .padding(.leading, 5)
                .padding(.top, 3)
            }
            .safeAreaInset(edge: .bottom) {
                if let selectedHost {
                    HostOfferCard(host: selectedHost, session: session) {
                        self.selectedHost = nil
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
                } else if let selectedCommunityNote {
                    CommunityNoteCard(note: selectedCommunityNote) {
                        self.selectedCommunityNote = nil
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
                }
            }
            .task {
                await loadOffers(in: .initialTrustrootsRegion)
                await loadCircles()
                if showingCommunityNotes { communityNotes.connect() }
            }
            .task(id: searchLocation) {
                guard let searchLocation, !searchLocation.isEmpty else { return }
                await focus(on: searchLocation)
            }
            .sheet(isPresented: $showingFilters, onDismiss: {
                Task { await loadOffers(in: visibleRegion) }
            }) {
                MapFilterSheet(
                    showingHosts: $showingHosts,
                    showingCommunityNotes: $showingCommunityNotes,
                    circles: circles,
                    selectedCircleIDs: $selectedCircleIDs
                )
            }
            .onChange(of: currentLocation.coordinate?.latitude) { _, _ in
                guard let coordinate = currentLocation.coordinate else { return }
                position = .region(MKCoordinateRegion(
                    center: coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 1.2, longitudeDelta: 1.2)
                ))
            }
            .onChange(of: showingCommunityNotes) { _, enabled in
                selectedCommunityNote = nil
                if enabled { communityNotes.connect() } else { communityNotes.disconnect() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .alert(
                "Current location",
                isPresented: Binding(
                    get: { currentLocation.errorMessage != nil },
                    set: { if !$0 { currentLocation.clearError() } }
                )
            ) {
                Button("OK", role: .cancel) { currentLocation.clearError() }
            } message: {
                Text(currentLocation.errorMessage ?? "")
            }
        }
    }

    private func loadOffers(in region: MKCoordinateRegion) async {
        let types = showingHosts ? ["host"] : []
        searchGeneration += 1
        let generation = searchGeneration
        guard !types.isEmpty else {
            offers = []
            selectedHost = nil
            isLoading = false
            return
        }
        isLoading = true
        errorMessage = nil
        defer {
            if generation == searchGeneration {
                isLoading = false
            }
        }

        do {
            let fetchedOffers = try await api.searchOffers(
                serverURLString: session.serverURLString,
                in: region,
                types: types,
                tribeIDs: selectedCircleIDs.sorted()
            )
            guard generation == searchGeneration else { return }
            offers = fetchedOffers
        } catch {
            guard generation == searchGeneration else { return }
            errorMessage = error.localizedDescription
        }
    }

    private var resultCountLabel: String {
        return "\(offers.count) hosts in this area"
    }

    private var resultCountColor: Color {
        TrustrootsPalette.hostYes
    }

    private func loadCircles() async {
        circles = (try? await api.circles(serverURLString: session.serverURLString)) ?? []
    }

    private func focus(on location: String) async {
        guard let placemark = try? await CLGeocoder().geocodeAddressString(location).first,
              let coordinate = placemark.location?.coordinate else { return }
        position = .region(MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 1.4, longitudeDelta: 1.4)
        ))
    }

    private func loadHost(offerID: String) async {
        guard !isLoadingHost else { return }
        isLoadingHost = true
        errorMessage = nil
        defer { isLoadingHost = false }

        do {
            selectedHost = try await api.offer(serverURLString: session.serverURLString, offerID: offerID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func select(_ cluster: HostCluster) async {
        if cluster.count > 1 {
            position = .region(cluster.zoomedRegion(from: visibleRegion))
        } else if let offerID = cluster.offers.first?.id {
            await loadHost(offerID: offerID)
        }
    }
}

private struct HostOfferCard: View {
    let host: HostOffer
    @ObservedObject var session: MemberSessionStore
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            NavigationLink {
                MemberProfileView(session: session, username: host.user.username)
            } label: {
                MemberAvatarView(
                    memberID: host.user.id,
                    displayName: host.user.displayName ?? host.user.username ?? "Trustroots member",
                    serverURLString: session.serverURLString,
                    size: 46
                )
            }

            NavigationLink {
                MemberProfileView(session: session, username: host.user.username)
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Potential host")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(TrustrootsPalette.green)
                    Text(host.user.displayName ?? host.user.username ?? "Trustroots member")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    if let description = (host.description ?? host.noOfferDescription)?.plainText,
                       !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: dismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(8)
                    .background(Color.secondary.opacity(0.12))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Dismiss potential host")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct HostMapDot: View {
    let count: Int
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(color)
            if count > 1 {
                Text(count > 99 ? "99+" : "\(count)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
            } else {
                Circle()
                    .fill(.white)
                    .frame(width: 7, height: 7)
            }
        }
        .frame(width: count > 1 ? 42 : 22, height: count > 1 ? 42 : 22)
        .overlay(Circle().stroke(.white, lineWidth: 3))
        .shadow(color: .black.opacity(0.3), radius: 4, y: 2)
        .contentShape(Circle())
    }
}

private struct MapOfferLegend: View {
    let showingHosts: Bool
    let showingCommunityNotes: Bool

    var body: some View {
        HStack(spacing: 9) {
            if showingHosts {
                LegendItem(color: TrustrootsPalette.hostYes, label: "Hosting")
                LegendItem(color: TrustrootsPalette.hostMaybe, label: "Maybe")
            }
            if showingCommunityNotes {
                LegendItem(color: TrustrootsPalette.communityNote, label: "Notes")
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(.regularMaterial)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.1), radius: 3, y: 1)
    }
}

private struct CommunityNoteCard: View {
    let note: CommunityNote
    let dismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "bubble.left.and.text.bubble.right.fill")
                .foregroundStyle(.white)
                .padding(9)
                .background(TrustrootsPalette.communityNote)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text("Community Note")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(TrustrootsPalette.communityNote)
                Text(note.content)
                    .font(.subheadline)
                    .lineLimit(4)
                Text("via Nostroots · \(note.createdAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(action: dismiss) { Image(systemName: "xmark") }
                .accessibilityLabel("Dismiss Community Note")
        }
        .padding(11)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct CommunityNoteCluster: Identifiable {
    let id: String
    let notes: [CommunityNote]
    let coordinate: CLLocationCoordinate2D

    static func group(_ notes: [CommunityNote], in region: MKCoordinateRegion) -> [CommunityNoteCluster] {
        let latitudeCell = max(region.span.latitudeDelta / 8, 0.12)
        let longitudeCell = max(region.span.longitudeDelta / 8, 0.12)
        let buckets = Dictionary(grouping: notes) { note in
            "\(Int(floor((note.latitude + 90) / latitudeCell)))-\(Int(floor((note.longitude + 180) / longitudeCell)))"
        }
        return buckets.map { key, grouped in
            CommunityNoteCluster(
                id: "note-\(key)",
                notes: grouped,
                coordinate: CLLocationCoordinate2D(
                    latitude: grouped.map(\.latitude).reduce(0, +) / Double(grouped.count),
                    longitude: grouped.map(\.longitude).reduce(0, +) / Double(grouped.count)
                )
            )
        }
    }

    func zoomedRegion(from region: MKCoordinateRegion) -> MKCoordinateRegion {
        MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(
                latitudeDelta: max(region.span.latitudeDelta / 2, 0.08),
                longitudeDelta: max(region.span.longitudeDelta / 2, 0.08)
            )
        )
    }
}

private struct LegendItem: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
        }
    }
}

private struct HostCluster: Identifiable {
    let id: String
    let offers: [MapOffer]
    let coordinate: CLLocationCoordinate2D

    var count: Int { offers.count }

    var color: Color {
        if offers.allSatisfy({
            $0.type == "host" && $0.properties.status == "maybe"
        }) {
            return TrustrootsPalette.hostMaybe
        }
        guard count == 1, let offer = offers.first else {
            return TrustrootsPalette.darkGreen
        }
        switch (offer.type, offer.properties.status ?? "yes") {
        case ("host", "yes"):
            return TrustrootsPalette.hostYes
        case ("host", "maybe"):
            return TrustrootsPalette.hostMaybe
        default:
            return .gray
        }
    }

    static func group(_ offers: [MapOffer], in region: MKCoordinateRegion) -> [HostCluster] {
        let latitudeCell = max(region.span.latitudeDelta / 8, 0.12)
        let longitudeCell = max(region.span.longitudeDelta / 8, 0.12)
        let buckets = Dictionary(grouping: offers.compactMap { offer -> (String, MapOffer)? in
            guard let coordinate = offer.coordinate else { return nil }
            let latitudeBucket = Int(floor((coordinate.latitude + 90) / latitudeCell))
            let longitudeBucket = Int(floor((coordinate.longitude + 180) / longitudeCell))
            return ("\(latitudeBucket)-\(longitudeBucket)", offer)
        }, by: \.0)

        return buckets.compactMap { key, entries in
            let groupedOffers = entries.map(\.1)
            let coordinates = groupedOffers.compactMap(\.coordinate)
            guard !coordinates.isEmpty else { return nil }
            let latitude = coordinates.map(\.latitude).reduce(0, +) / Double(coordinates.count)
            let longitude = coordinates.map(\.longitude).reduce(0, +) / Double(coordinates.count)
            return HostCluster(
                id: key,
                offers: groupedOffers,
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
            )
        }
    }

    func zoomedRegion(from region: MKCoordinateRegion) -> MKCoordinateRegion {
        MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(
                latitudeDelta: max(region.span.latitudeDelta / 2, 0.08),
                longitudeDelta: max(region.span.longitudeDelta / 2, 0.08)
            )
        )
    }
}

private extension MKCoordinateRegion {
    static let initialTrustrootsRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 38.7223, longitude: -9.1393),
        span: MKCoordinateSpan(latitudeDelta: 8, longitudeDelta: 8)
    )
}

private extension String {
    var plainText: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    }
}
