import MapKit
import SwiftUI
import TrustrootsShared
import UIKit

private enum SearchMode: String, Hashable {
    case map
    case results
    case members
}

private enum OfferResultDetails {
    case loading(UUID)
    case loaded(HostOffer)
    case failed
}

struct OfferMapView: View {
    @ObservedObject var session: MemberSessionStore
    let searchLocation: String?
    let memberSearchState: MemberSearchState
    @State private var position = MapCameraPosition.region(.initialTrustrootsRegion)
    @State private var visibleRegion = MKCoordinateRegion.initialTrustrootsRegion
    @State private var offers: [MapOffer] = []
    @State private var isLoading = true
    @State private var mapStatusHeight: CGFloat = 1
    @State private var errorMessage: String?
    @State private var resultDetails: [String: OfferResultDetails] = [:]
    @State private var selectedHost: (offer: HostOffer, mapType: String)?
    @State private var isLoadingHost = false
    @State private var showingFilters = false
    @State private var showingHosts = true
    @State private var showingMeet = false
    @State private var volunteering = false
    @State private var connectionsOnly = false
    @State private var selectedLanguages: Set<String> = []
    @State private var searchMode = SearchMode.map
    @State private var profilePath: [String] = []
    @State private var searchDisplayHeight: CGFloat = 50
    @State private var placeSearch = OfferPlaceSearchState()
    @State private var placeSearchHeight: CGFloat = 124
    @State private var showingCommunityNotes = true
    @State private var activityMonths: Int? = 6
    @State private var circles: [TrustrootsCircle] = []
    @State private var selectedCircleIDs: Set<String> = []
    @State private var searchGeneration = 0
    @State private var placeSearchGeneration = 0
    @StateObject private var currentLocation = CurrentLocationManager()
    @StateObject private var communityNotes = CommunityNotesStore()
    @State private var selectedCommunityNote: CommunityNote?

    private let api = TrustrootsAPI()

    private var clusters: [HostCluster] {
        HostCluster.group(offers, in: visibleRegion)
    }

    private var showsNotes: Bool { showingCommunityNotes && !connectionsOnly }

    var body: some View {
        NavigationStack(path: $profilePath) {
            VStack(spacing: 0) {
                SearchDisplayController(selection: $searchMode, height: $searchDisplayHeight)
                    .frame(height: searchDisplayHeight)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)

                ZStack {
                    switch searchMode {
                    case .map: mapView
                    case .results: resultsView
                    case .members:
                        MemberSearchView(
                            session: session,
                            state: memberSearchState,
                            showsNavigationBar: false,
                            onProfile: { profilePath.append($0) }
                        )
                    }
                }
            }
            .navigationDestination(for: String.self) { username in
                MemberProfileView(session: session, username: username)
            }
            .safeAreaInset(edge: .bottom) {
                if searchMode != .members, let selectedHost {
                    HostOfferCard(host: selectedHost.offer, mapType: selectedHost.mapType, session: session) {
                        self.selectedHost = nil
                    }
                } else if searchMode != .members, let selectedCommunityNote {
                    CommunityNoteCard(note: selectedCommunityNote) {
                        self.selectedCommunityNote = nil
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
                }
            }
            .task {
                await loadOffers(in: visibleRegion)
                await loadCircles()
                if showsNotes { communityNotes.connect() }
            }
            .task(id: searchLocation) {
                guard let searchLocation, !searchLocation.isEmpty else { return }
                await focus(on: searchLocation)
            }
            .sheet(isPresented: $showingFilters, onDismiss: {
                selectedHost = nil
                selectedCommunityNote = nil
                Task { await loadOffers(in: visibleRegion) }
            }) {
                MapFilterSheet(
                    showingHosts: $showingHosts,
                    showingMeet: $showingMeet,
                    showingCommunityNotes: $showingCommunityNotes,
                    activityMonths: $activityMonths,
                    circles: circles,
                    selectedCircleIDs: $selectedCircleIDs,
                    languages: $selectedLanguages,
                    volunteering: $volunteering,
                    connectionsOnly: $connectionsOnly
                )
            }
            .onChange(of: currentLocation.coordinate?.latitude) { _, _ in
                guard let coordinate = currentLocation.coordinate else { return }
                let region = MKCoordinateRegion(
                    center: coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 1.2, longitudeDelta: 1.2)
                )
                position = .region(region)
                if searchMode != .map {
                    visibleRegion = region
                    Task { await loadOffers(in: region) }
                }
            }
            .onChange(of: searchMode) { previous, _ in
                if previous == .map { position = .region(visibleRegion) }
                selectedCommunityNote = nil
            }
            .onChange(of: showsNotes) { _, enabled in
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

    private var mapView: some View {
        MetricScaleMap {
            Map(position: $position) {
                ForEach(clusters) { cluster in
                    Annotation("", coordinate: cluster.coordinate) {
                        Button {
                            Task { await select(cluster) }
                        } label: {
                            HostMapDot(
                                count: cluster.count,
                                color: cluster.color,
                                icon: cluster.offers.first?.type == "meet" ? "cup.and.saucer.fill" : "sofa.fill"
                            )
                        }
                        .accessibilityLabel(cluster.accessibilityLabel)
                    }
                }
                if showsNotes {
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
        }
        .overlay(alignment: .topTrailing) {
            if isLoading || !offers.isEmpty || errorMessage != nil {
                MapOfferStatusController(
                    isLoading: isLoading,
                    countLabel: offers.isEmpty ? nil : resultCountLabel,
                    legend: mapLegend,
                    error: errorMessage,
                    height: $mapStatusHeight
                )
                .frame(maxWidth: .infinity)
                .frame(height: mapStatusHeight)
                .clipped()
                .padding(.leading, 54)
                .padding(.trailing, 12)
                .padding(.top, 5)
                .allowsHitTesting(false)
            }
        }
        .overlay(alignment: .topLeading) {
            VStack(spacing: 8) {
                MapOfferActionController(action: .filters, symbol: "slider.horizontal.3") {
                    showingFilters = true
                }
                .frame(width: 44, height: 44)

                MapOfferActionController(action: .currentlocation, symbol: "location.fill") {
                    currentLocation.useCurrentLocation()
                }
                .frame(width: 44, height: 44)
            }
            .padding(.leading, 5)
            .padding(.top, 3)
        }
    }

    private var resultsView: some View {
        VStack(spacing: 0) {
            OfferPlaceSearchController(
                state: placeSearch,
                onSearch: { query in Task { await focus(on: query) } },
                onFilters: { showingFilters = true },
                height: $placeSearchHeight
            )
            .frame(height: placeSearchHeight)
            .padding(.horizontal, 16)

            NearbyOfferResultsController(
                rows: offers.map(resultRow),
                loading: isLoading,
                error: errorMessage,
                serverURLString: session.serverURLString,
                retry: { Task { await loadOffers(in: visibleRegion) } },
                loadOffer: { id in Task { await loadResultDetails(for: id) } },
                openOffer: openResult
            )
        }
    }

    private func resultRow(_ offer: MapOffer) -> PilotNearbyOfferRow {
        guard case let .loaded(host) = resultDetails[offer.id] else {
            let failed = if case .failed = resultDetails[offer.id] { true } else { false }
            return PilotNearbyOfferRow(
                id: offer.id, title: nil, username: nil, memberId: nil, badges: [], summary: nil, failed: failed
            )
        }

        var badges: [String] = []
        if offer.type == "host" {
            badges.append(offer.properties.status == "maybe" ? "Maybe hosting" : "Hosting")
        }
        if let meeting = host.meetingLabel {
            badges.append(meeting)
        } else if offer.type == "meet" {
            badges.append("Available to meet")
        }
        if host.volunteering == true { badges.append("Offers volunteering") }

        return PilotNearbyOfferRow(
            id: offer.id,
            title: host.user.displayName ?? host.user.username ?? "Trustroots member",
            username: host.user.username,
            memberId: host.user.id,
            badges: badges,
            summary: host.description?.plainText,
            failed: false
        )
    }

    private func loadResultDetails(for id: String) async {
        guard offers.contains(where: { $0.id == id }) else { return }
        switch resultDetails[id] {
        case .loading, .loaded: return
        case .failed, nil: break
        }
        let request = UUID()
        resultDetails[id] = .loading(request)
        let details: OfferResultDetails
        do {
            details = .loaded(try await api.offer(serverURLString: session.serverURLString, offerID: id))
        } catch {
            details = .failed
        }
        guard case let .loading(pending) = resultDetails[id], pending == request else { return }
        resultDetails[id] = details
    }

    private func openResult(_ id: String) {
        guard !isLoading, errorMessage == nil,
              let offer = offers.first(where: { $0.id == id }),
              case let .loaded(host) = resultDetails[id]
        else { return }
        selectedCommunityNote = nil
        selectedHost = (host, offer.type)
    }

    private func loadOffers(in region: MKCoordinateRegion) async {
        let types = (showingHosts ? ["host"] : []) + (showingMeet ? ["meet"] : [])
        searchGeneration += 1
        let generation = searchGeneration
        guard !types.isEmpty else {
            offers = []
            resultDetails = [:]
            selectedHost = nil
            isLoading = false
            errorMessage = nil
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
                tribeIDs: selectedCircleIDs.sorted(),
                seenWithinMonths: activityMonths,
                languages: selectedLanguages.sorted(),
                volunteering: volunteering,
                connectionsOnly: connectionsOnly
            )
            guard generation == searchGeneration else { return }
            offers = fetchedOffers
            let visibleIDs = Set(fetchedOffers.map(\.id))
            resultDetails = resultDetails.filter { visibleIDs.contains($0.key) }
        } catch {
            guard generation == searchGeneration else { return }
            errorMessage = error.localizedDescription
        }
    }

    private var resultCountLabel: String {
        "\(offers.count) offers in this area"
    }

    private var mapLegend: [MapLegendSwatch] {
        guard !isLoading, !offers.isEmpty else { return [] }
        var legend: [MapLegendSwatch] = []
        if showingHosts {
            legend.append(MapLegendSwatch(label: "Hosting", colour: TrustrootsPalette.hostYes))
            legend.append(MapLegendSwatch(label: "Maybe", colour: TrustrootsPalette.hostMaybe))
        }
        if showingMeet { legend.append(MapLegendSwatch(label: "Meet", colour: .orange)) }
        if showsNotes { legend.append(MapLegendSwatch(label: "Notes", colour: TrustrootsPalette.communityNote)) }
        return legend
    }

    private func loadCircles() async {
        circles = (try? await api.circles(serverURLString: session.serverURLString)) ?? []
    }

    private func focus(on location: String) async {
        placeSearchGeneration += 1
        let generation = placeSearchGeneration
        placeSearch.updateFailure(failed: false)
        let placemark = try? await CLGeocoder().geocodeAddressString(location).first
        guard !Task.isCancelled, generation == placeSearchGeneration else { return }
        guard let coordinate = placemark?.location?.coordinate else {
            placeSearch.updateFailure(failed: searchMode != .map)
            return
        }
        selectedHost = nil
        selectedCommunityNote = nil
        let region = MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 1.4, longitudeDelta: 1.4)
        )
        position = .region(region)
        if searchMode != .map {
            visibleRegion = region
            await loadOffers(in: region)
        }
    }

    private func loadHost(for offer: MapOffer) async {
        guard !isLoadingHost else { return }
        isLoadingHost = true
        errorMessage = nil
        defer { isLoadingHost = false }

        do {
            let details = try await api.offer(serverURLString: session.serverURLString, offerID: offer.id)
            selectedHost = (details, offer.type)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func select(_ cluster: HostCluster) async {
        if cluster.count > 1 {
            position = .region(cluster.zoomedRegion(from: visibleRegion))
        } else if let offer = cluster.offers.first {
            await loadHost(for: offer)
        }
    }
}

@MainActor
private struct SearchDisplayController: UIViewControllerRepresentable {
    @Binding var selection: SearchMode
    @Binding var height: CGFloat

    final class Coordinator {
        let state = OfferSearchDisplayState()
        var onSelect: ((String) -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let measuredHeight = $height
        return OfferSearchDisplayControllerKt.OfferSearchDisplayViewController(
            state: coordinator.state,
            onSelect: { [weak coordinator] key in coordinator?.onSelect?(key) },
            onHeight: { value in
                let next = max(1, CGFloat(value.doubleValue))
                Task { @MainActor in
                    if measuredHeight.wrappedValue != next { measuredHeight.wrappedValue = next }
                }
            }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.state.update(selectedKey: selection.rawValue)
        coordinator.onSelect = { key in
            if let mode = SearchMode(rawValue: key) { selection = mode }
        }
    }
}

@MainActor
private struct OfferPlaceSearchController: UIViewControllerRepresentable {
    let state: OfferPlaceSearchState
    let onSearch: (String) -> Void
    let onFilters: () -> Void
    @Binding var height: CGFloat

    final class Coordinator {
        var onSearch: ((String) -> Void)?
        var onFilters: (() -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let measuredHeight = $height
        return OfferPlaceSearchControllerKt.OfferPlaceSearchViewController(
            state: state,
            onSearch: { [weak coordinator] query in coordinator?.onSearch?(query) },
            onFilters: { [weak coordinator] in coordinator?.onFilters?() },
            onHeight: { value in
                let next = max(1, CGFloat(value.doubleValue))
                Task { @MainActor in
                    if measuredHeight.wrappedValue != next { measuredHeight.wrappedValue = next }
                }
            }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onSearch = onSearch
        coordinator.onFilters = onFilters
    }
}

private struct NearbyOfferResultsController: UIViewControllerRepresentable {
    let rows: [PilotNearbyOfferRow]
    let loading: Bool
    let error: String?
    let serverURLString: String
    let retry: () -> Void
    let loadOffer: (String) -> Void
    let openOffer: (String) -> Void

    final class Coordinator {
        let state = NearbyOfferResultsState()
        var serverURLString = ""
        var retry: (() -> Void)?
        var loadOffer: ((String) -> Void)?
        var openOffer: ((String) -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        return MainViewControllerKt.NearbyOfferResultsViewController(
            state: coordinator.state,
            retry: { [weak coordinator] in coordinator?.retry?() },
            loadOffer: { [weak coordinator] id in coordinator?.loadOffer?(id) },
            openOffer: { [weak coordinator] id in coordinator?.openOffer?(id) },
            createAvatar: { [weak coordinator] row in
                guard let coordinator, let title = row.title else { return UIViewController() }
                return makeSharedMemberAvatarController(
                    memberID: row.memberId,
                    name: title,
                    serverURLString: coordinator.serverURLString
                )
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.serverURLString = serverURLString
        coordinator.retry = retry
        coordinator.loadOffer = loadOffer
        coordinator.openOffer = openOffer
        coordinator.state.update(loading: loading, error: error, rows: rows)
    }
}

private struct HostOfferCard: View {
    let host: HostOffer
    let mapType: String
    @ObservedObject var session: MemberSessionStore
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(mapType == "meet" ? host.meetingLabel ?? "Available to meet" : "Potential host")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(TrustrootsPalette.darkGreen)
                    if mapType == "host", let meeting = host.meetingLabel {
                        Text(meeting).font(.caption.weight(.semibold))
                    }
                    if host.volunteering == true {
                        Text("Offers volunteering").font(.caption.weight(.semibold))
                    }
                    if let username = host.user.username {
                        NavigationLink {
                            MemberProfileView(session: session, username: username)
                        } label: {
                            identity
                        }
                        .accessibilityLabel("View \(host.user.displayName ?? username)'s profile")
                    } else {
                        identity
                    }
                }

                Button(action: dismiss) {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                        .padding(9)
                        .background(Color.secondary.opacity(0.12))
                        .clipShape(Circle())
                }
                .accessibilityLabel(mapType == "meet" ? "Dismiss meeting offer" : "Dismiss potential host")
            }

            if mapType == "meet" {
                if let description = host.description {
                    Text(description.plainText).font(.subheadline)
                }
            } else {
                HostingDetailsView(
                    status: host.status,
                    description: host.description,
                    noOfferDescription: host.noOfferDescription,
                    maxGuests: host.maxGuests,
                    compact: true
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 14)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
        .shadow(color: .black.opacity(0.18), radius: 12, y: -4)
    }

    private var identity: some View {
        MemberIdentityView(
            member: host.user,
            serverURLString: session.serverURLString
        )
    }
}

private struct HostMapDot: View {
    let count: Int
    let color: Color
    var icon = "sofa.fill"

    var body: some View {
        ZStack {
            Circle()
                .fill(color)
            if count > 1 {
                Text(count > 99 ? "99+" : "\(count)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
            } else {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: count > 1 ? 42 : 30, height: count > 1 ? 42 : 30)
        .overlay(Circle().stroke(.white, lineWidth: 3))
        .shadow(color: .black.opacity(0.3), radius: 4, y: 2)
        .contentShape(Circle())
    }
}

private struct MapLegendSwatch {
    let label: String
    let colour: Color
}

@MainActor
private struct MapOfferStatusController: UIViewControllerRepresentable {
    let isLoading: Bool
    let countLabel: String?
    let legend: [MapLegendSwatch]
    let error: String?
    @Binding var height: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    final class Coordinator {
        let state = MapOfferStatusState()
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let state = context.coordinator.state
        update(state)
        let measuredHeight = $height
        return MapOfferStatusViewControllerKt.MapOfferStatusViewController(
            state: state,
            onHeight: { applyMapContentHeight($0.doubleValue, to: measuredHeight) }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        update(context.coordinator.state)
    }

    private func update(_ state: MapOfferStatusState) {
        state.update(content: MapOfferStatusContent(
            isLoading: isLoading,
            countLabel: countLabel,
            countMarkerArgb: mapColourArgb(TrustrootsPalette.hostYes, for: colorScheme),
            legend: legend.map {
                MapOfferLegendMarker(label: $0.label, argb: mapColourArgb($0.colour, for: colorScheme))
            },
            error: error
        ))
    }
}

@MainActor
private struct MapOfferActionController: UIViewControllerRepresentable {
    let action: OfferMapAction
    let symbol: String
    let onTap: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    final class Coordinator {
        var onTap: (() -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        coordinator.onTap = onTap
        let symbolName = symbol
        return OfferMapActionViewControllerKt.OfferMapActionViewController(
            action: action,
            surfaceArgb: mapColourArgb(TrustrootsPalette.paleGreen.opacity(0.96), for: colorScheme),
            onTap: { [weak coordinator] in coordinator?.onTap?() },
            createIcon: { makeMapSymbol(symbolName, tint: UIColor(TrustrootsPalette.darkGreen)) }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        context.coordinator.onTap = onTap
    }
}

@MainActor
private func makeMapSymbol(_ name: String, tint: UIColor) -> UIImageView {
    let configuration = UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
    let image = UIImage(systemName: name, withConfiguration: configuration)
    let view = UIImageView(image: image?.withRenderingMode(.alwaysTemplate))
    view.contentMode = .scaleAspectFit
    view.tintColor = tint
    view.isAccessibilityElement = false
    view.isUserInteractionEnabled = false
    return view
}

private func applyMapContentHeight(_ points: Double, to height: Binding<CGFloat>) {
    let next = max(1, CGFloat(points))
    Task { @MainActor in
        if height.wrappedValue != next {
            height.wrappedValue = next
        }
    }
}

private func mapColourArgb(_ colour: Color, for colorScheme: ColorScheme) -> Int64 {
    let traits = UITraitCollection(userInterfaceStyle: colorScheme == .dark ? .dark : .light)
    let resolved = UIColor(colour).resolvedColor(with: traits)
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    var alpha: CGFloat = 0
    guard resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return 0xFF808080 }
    return [alpha, red, green, blue].reduce(Int64(0)) { result, component in
        let byte = Int64((min(1, max(0, component)) * 255).rounded())
        return (result << 8) | byte
    }
}

struct CommunityNotePresentation {
    let text: String
    let attribution: String

    init(note: CommunityNote) {
        text = note.content
        attribution = "via Nostroots · \(note.createdAt.formatted(date: .abbreviated, time: .omitted))"
    }
}

private struct CommunityNoteCard: View {
    let note: CommunityNote
    let dismiss: () -> Void
    @State private var height: CGFloat = 1

    var body: some View {
        ComposeCommunityNoteCard(
            presentation: CommunityNotePresentation(note: note),
            onDismiss: dismiss,
            height: $height
        )
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipped()
    }
}

@MainActor
private struct ComposeCommunityNoteCard: UIViewControllerRepresentable {
    let presentation: CommunityNotePresentation
    let onDismiss: () -> Void
    @Binding var height: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    final class Coordinator {
        let state = CommunityNoteCardState()
        var onDismiss: (() -> Void)?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let measuredHeight = $height
        return CommunityNoteCardViewControllerKt.CommunityNoteCardViewController(
            state: coordinator.state,
            onDismiss: { [weak coordinator] in coordinator?.onDismiss?() },
            onHeight: { applyMapContentHeight($0.doubleValue, to: measuredHeight) },
            createIcon: { makeMapSymbol("bubble.left.and.text.bubble.right.fill", tint: .white) }
        )
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.onDismiss = onDismiss
        coordinator.state.update(content: CommunityNoteCardContent(
            text: presentation.text,
            attribution: presentation.attribution,
            markerArgb: mapColourArgb(TrustrootsPalette.communityNote, for: colorScheme)
        ))
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

private struct HostCluster: Identifiable {
    let id: String
    let offers: [MapOffer]
    let coordinate: CLLocationCoordinate2D

    var count: Int { offers.count }

    var accessibilityLabel: String {
        if count > 1 { return "View \(count) offers" }
        return offers.first?.type == "meet" ? "View meeting offer" : "View potential host"
    }

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
        case ("meet", _):
            return .orange
        default:
            return .gray
        }
    }

    static func group(_ offers: [MapOffer], in region: MKCoordinateRegion) -> [HostCluster] {
        if max(region.span.latitudeDelta, region.span.longitudeDelta) <= 0.2 {
            return offers.compactMap { offer in
                guard let coordinate = offer.coordinate else { return nil }
                return HostCluster(id: offer.id, offers: [offer], coordinate: coordinate)
            }
        }

        let latitudeCell = region.span.latitudeDelta / 10
        let longitudeCell = region.span.longitudeDelta / 10
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
