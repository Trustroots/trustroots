import Combine
import CoreLocation
import SwiftUI
import TrustrootsShared
import UIKit

private enum HostingAvailability: String {
    case yes, maybe, no
}

private enum MeetingAvailability: String {
    case yes, maybe, no
    case notSet = "not-set"
}

private struct HostingOfferForm: Equatable {
    var id: String?
    var hosting: HostingAvailability
    var meeting: MeetingAvailability
    var description: String
    var noOfferDescription: String
    var maxGuests: Int
    var volunteering: Bool
    var onlyMyCircles: Bool
    var latitude: String
    var longitude: String
    private let savedDescription: String
    private let savedNoOfferDescription: String

    init(offer: AccommodationOffer?) {
        id = offer?.id
        hosting = offer?.status.flatMap(HostingAvailability.init(rawValue:)) ?? .yes
        meeting = offer?.meetingStatus.flatMap(MeetingAvailability.init(rawValue:)) ?? .notSet
        savedDescription = offer?.description ?? ""
        savedNoOfferDescription = offer?.noOfferDescription ?? ""
        description = Self.editableText(savedDescription)
        noOfferDescription = Self.editableText(savedNoOfferDescription)
        maxGuests = offer?.maxGuests ?? 1
        volunteering = offer?.volunteering ?? false
        onlyMyCircles = offer?.showOnlyInMyCircles ?? false
        if let location = offer?.location, location.count == 2 {
            latitude = String(location[0])
            longitude = String(location[1])
        } else {
            latitude = ""
            longitude = ""
        }
    }

    var coordinates: [Double]? {
        guard let latitude = Double(latitude.trimmingCharacters(in: .whitespacesAndNewlines)),
              let longitude = Double(longitude.trimmingCharacters(in: .whitespacesAndNewlines)),
              (-90...90).contains(latitude), (-180...180).contains(longitude)
        else { return nil }
        // The offer endpoint rejects the web editor’s default map centre.
        guard latitude != 48.6908333333 || longitude != 9.14055555556 else { return nil }
        return [latitude, longitude]
    }

    var descriptionTooShort: Bool {
        description.trimmingCharacters(in: .whitespacesAndNewlines).count < 5
    }

    var update: HostingOfferUpdate? {
        guard let coordinates,
              (0...99).contains(maxGuests),
              hosting == .no || !descriptionTooShort
        else { return nil }

        return HostingOfferUpdate(
            status: hosting.rawValue,
            meetingStatus: meeting.rawValue,
            description: preservedOrEdited(description, saved: savedDescription),
            noOfferDescription: preservedOrEdited(noOfferDescription, saved: savedNoOfferDescription),
            maxGuests: maxGuests,
            volunteering: volunteering,
            showOnlyInMyCircles: onlyMyCircles,
            location: coordinates
        )
    }

    private func preservedOrEdited(_ value: String, saved: String) -> String {
        value == Self.editableText(saved) ? saved : value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func editableText(_ saved: String) -> String {
        // The rich-text decoder uses paragraph closings as separators. The
        // final closing tag adds no separator to the editable document.
        let markup = saved.replacingOccurrences(
            of: "</p>(?=\\s*\\z)",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        return TrustrootsRichText.plainText(markup)
    }
}

struct HostingOfferEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var session: MemberSessionStore
    let onSaved: () -> Void

    @StateObject private var location = CurrentLocationManager()
    @State private var form: HostingOfferForm?
    @State private var savedForm: HostingOfferForm?
    @State private var memberID: String?
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var isHostingTextFocused = false
    @State private var requestedLocation = false
    @State private var attemptedCreation = false
    @State private var error: String?
    @State private var showSaved = false
    @State private var confirmClose = false

    private let api = TrustrootsAPI()

    var body: some View {
        NavigationStack {
            Group {
                if let binding = Binding($form) {
                    editor(binding)
                } else if let error {
                    ContentUnavailableView {
                        Label("Hosting settings unavailable", systemImage: "exclamationmark.circle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Try again") { Task { await load() } }
                    }
                } else {
                    ProgressView("Loading hosting settings…")
                }
            }
            .navigationTitle("Hosting and meetings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        if isDirty { confirmClose = true } else { dismiss() }
                    }
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") { Task { await save() } }
                        .disabled(isSaving || !isDirty || form?.update == nil)
                        .accessibilityIdentifier("save-hosting-offer")
                }
            }
            .alert("Discard changes?", isPresented: $confirmClose) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep editing", role: .cancel) {}
            }
        }
        .interactiveDismissDisabled(isDirty || isSaving)
        .task { await load() }
        .onReceive(location.$coordinate) { coordinate in
            guard requestedLocation, !isSaving, let coordinate else { return }
            form?.latitude = String(coordinate.latitude)
            form?.longitude = String(coordinate.longitude)
            requestedLocation = false
        }
    }

    private var isDirty: Bool { form != savedForm }

    private func editor(_ binding: Binding<HostingOfferForm>) -> some View {
        ScrollViewReader { proxy in
            Form {
                Section {
                    HostingSettingsSection(form: binding, isEnabled: !isSaving, panel: .availability)
                } footer: {
                    Text("You can meet even when you are not hosting. Both use this location and circle visibility.")
                }

                Section("Hosting details") {
                    HostingSettingsSection(form: binding, isEnabled: !isSaving, panel: .details) { focused in
                        if isHostingTextFocused != focused { isHostingTextFocused = focused }
                    }
                    .id(HostingSettingsPanel.details)
                    .onDisappear { isHostingTextFocused = false }
                }

                Section("Location") {
                    TextField("Latitude", text: binding.latitude)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Longitude", text: binding.longitude)
                        .keyboardType(.numbersAndPunctuation)
                    Button("Use current location") {
                        requestedLocation = true
                        location.useCurrentLocation()
                    }
                    if requestedLocation, let error = location.errorMessage {
                        Text(error).foregroundStyle(.red)
                    }
                    Text(binding.wrappedValue.coordinates == nil
                        ? "Enter a latitude from −90 to 90 and a longitude from −180 to 180."
                        : "Other members see an approximate location.")
                        .foregroundStyle(.secondary)
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
                if showSaved && !isDirty {
                    Section { Text("Hosting and meeting settings saved.") }
                }
            }
            .disabled(isSaving)
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardDidShowNotification)) { _ in
                if isHostingTextFocused {
                    proxy.scrollTo(HostingSettingsPanel.details, anchor: .top)
                }
            }
        }
    }

    private func load() async {
        guard !isLoading, let username = session.member?.username else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        let server = session.serverURLString
        do {
            let profile = try await api.profile(serverURLString: server, username: username, allowSaved: false)
            guard let id = profile.id else { throw TrustrootsAPIError.invalidResponse }
            let offer = try await api.accommodationOffer(serverURLString: server, userID: id, allowSaved: false)
            guard !Task.isCancelled, server == session.serverURLString, username == session.member?.username else { return }
            memberID = id
            let draft = HostingOfferForm(offer: offer)
            form = draft
            savedForm = draft
        } catch {
            if !Task.isCancelled { self.error = error.localizedDescription }
        }
    }

    private func save() async {
        guard !isSaving, isDirty, var submitted = form, let update = submitted.update,
              let memberID, let username = session.member?.username else { return }
        isSaving = true
        showSaved = false
        error = nil
        defer { isSaving = false }

        let server = session.serverURLString
        do {
            if submitted.id == nil && attemptedCreation {
                // An earlier request can save successfully before its response is lost.
                submitted.id = try await api.accommodationOffer(
                    serverURLString: server, userID: memberID, allowSaved: false
                )?.id
            }
            guard !Task.isCancelled, server == session.serverURLString, username == session.member?.username else { return }
            if submitted.id == nil { attemptedCreation = true }
            submitted.id = try await api.saveHostingOffer(serverURLString: server, offerID: submitted.id, update: update)
            guard !Task.isCancelled, server == session.serverURLString, username == session.member?.username else { return }
            form = submitted
            savedForm = submitted
            showSaved = true
            onSaved()
        } catch {
            if !Task.isCancelled { self.error = error.localizedDescription }
        }
    }
}

private enum HostingSettingsPanel: Hashable {
    case availability
    case details
}

private struct HostingSettingsSection: View {
    @Binding var form: HostingOfferForm
    let isEnabled: Bool
    let panel: HostingSettingsPanel
    var onTextFocus: (Bool) -> Void = { _ in }
    @State private var height: CGFloat = 1

    var body: some View {
        HostingSettingsController(
            form: $form,
            height: $height,
            isEnabled: isEnabled,
            panel: panel,
            onTextFocus: onTextFocus
        )
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipped()
    }
}

@MainActor
private struct HostingSettingsController: UIViewControllerRepresentable {
    @Binding var form: HostingOfferForm
    @Binding var height: CGFloat
    let isEnabled: Bool
    let panel: HostingSettingsPanel
    let onTextFocus: (Bool) -> Void

    @MainActor
    final class Coordinator {
        let availability = HostingAvailabilitySettingsState()
        let details = HostingDetailsSettingsState()
        var view: HostingSettingsController?

        func edit(_ change: (inout HostingOfferForm) -> Void) {
            guard let view, view.isEnabled else { return }
            var updated = view.form
            change(&updated)
            view.form = updated
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let currentHeight = $height
        let resize: (Double) -> Void = { value in
            let measuredHeight = max(1, CGFloat(value))
            Task { @MainActor in
                if currentHeight.wrappedValue != measuredHeight {
                    currentHeight.wrappedValue = measuredHeight
                }
            }
        }
        switch panel {
        case .availability:
            return HostingAvailabilitySettingsControllerKt.HostingAvailabilitySettingsViewController(
                state: coordinator.availability,
                onHosting: { [weak coordinator] selection in
                    guard let availability = HostingAvailability(rawValue: selection) else { return }
                    coordinator?.edit { $0.hosting = availability }
                },
                onMeeting: { [weak coordinator] selection in
                    guard let availability = MeetingAvailability(rawValue: selection) else { return }
                    coordinator?.edit { $0.meeting = availability }
                },
                onAdjustGuests: { [weak coordinator] delta in
                    coordinator?.edit { draft in
                        let guests = draft.maxGuests + delta.intValue
                        guard draft.hosting != .no, (0...99).contains(guests) else { return }
                        draft.maxGuests = guests
                    }
                },
                onCirclesOnly: { [weak coordinator] checked in
                    coordinator?.edit { $0.onlyMyCircles = checked.boolValue }
                },
                onHeight: { resize($0.doubleValue) }
            )
        case .details:
            return HostingAvailabilitySettingsControllerKt.HostingDetailsSettingsViewController(
                state: coordinator.details,
                onDescription: { [weak coordinator] description in
                    coordinator?.edit { $0.description = description }
                },
                onUnavailableReason: { [weak coordinator] reason in
                    coordinator?.edit { $0.noOfferDescription = reason }
                },
                onVolunteering: { [weak coordinator] volunteering in
                    coordinator?.edit { $0.volunteering = volunteering.boolValue }
                },
                onTextFocus: { [weak coordinator] focused in
                    coordinator?.view?.onTextFocus(focused.boolValue)
                },
                onHeight: { resize($0.doubleValue) }
            )
        }
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.view = self
        switch panel {
        case .availability:
            coordinator.availability.update(
                hosting: form.hosting.rawValue,
                meeting: form.meeting.rawValue,
                maxGuests: Int32(clamping: form.maxGuests),
                circlesOnly: form.onlyMyCircles,
                enabled: isEnabled
            )
        case .details:
            coordinator.details.update(
                description: form.description,
                unavailableReason: form.noOfferDescription,
                isUnavailable: form.hosting == .no,
                descriptionTooShort: form.descriptionTooShort,
                volunteering: form.volunteering,
                enabled: isEnabled
            )
        }
    }
}
