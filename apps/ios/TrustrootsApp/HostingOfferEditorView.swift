import Combine
import CoreLocation
import SwiftUI
import TrustrootsShared

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
        description = TrustrootsRichText.plainText(savedDescription)
        noOfferDescription = TrustrootsRichText.plainText(savedNoOfferDescription)
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

    var update: HostingOfferUpdate? {
        guard let coordinates,
              (0...99).contains(maxGuests),
              hosting == .no || description.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5
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
        value == TrustrootsRichText.plainText(saved) ? saved : value.trimmingCharacters(in: .whitespacesAndNewlines)
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
        Form {
            Section {
                HostingAvailabilitySection(form: binding, isEnabled: !isSaving)
            } footer: {
                Text("You can meet even when you are not hosting. Both use this location and circle visibility.")
            }

            Section("Hosting details") {
                TextField("Hosting description", text: binding.description, axis: .vertical)
                    .lineLimit(3...7)
                if binding.wrappedValue.hosting == .no {
                    TextField("Why you are not hosting", text: binding.noOfferDescription, axis: .vertical)
                        .lineLimit(2...6)
                } else if binding.wrappedValue.description.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 {
                    Text("Enter at least five characters in your hosting description.")
                        .foregroundStyle(.secondary)
                }
                Toggle("Welcome help from volunteering guests", isOn: binding.volunteering)
                    .accessibilityIdentifier("hosting-volunteering")
                if binding.wrappedValue.volunteering {
                    Text("Explain what help you need, whether it is optional or expected, and what you offer guests.")
                        .foregroundStyle(.secondary)
                }
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

private struct HostingAvailabilitySection: View {
    @Binding var form: HostingOfferForm
    let isEnabled: Bool
    @State private var height: CGFloat = 1

    var body: some View {
        HostingAvailabilityController(form: $form, height: $height, isEnabled: isEnabled)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipped()
    }
}

@MainActor
private struct HostingAvailabilityController: UIViewControllerRepresentable {
    @Binding var form: HostingOfferForm
    @Binding var height: CGFloat
    let isEnabled: Bool

    final class Coordinator {
        let state = HostingAvailabilitySettingsState()
        var view: HostingAvailabilityController?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let coordinator = context.coordinator
        update(coordinator)
        let currentHeight = $height
        return HostingAvailabilitySettingsControllerKt.HostingAvailabilitySettingsViewController(
            state: coordinator.state,
            onHosting: { [weak coordinator] selection in
                guard let view = coordinator?.view, view.isEnabled,
                      let availability = HostingAvailability(rawValue: selection) else { return }
                view.$form.hosting.wrappedValue = availability
            },
            onMeeting: { [weak coordinator] selection in
                guard let view = coordinator?.view, view.isEnabled,
                      let availability = MeetingAvailability(rawValue: selection) else { return }
                view.$form.meeting.wrappedValue = availability
            },
            onAdjustGuests: { [weak coordinator] delta in
                guard let view = coordinator?.view, view.isEnabled, view.form.hosting != .no else { return }
                let guests = view.form.maxGuests + delta.intValue
                guard (0...99).contains(guests) else { return }
                view.$form.maxGuests.wrappedValue = guests
            },
            onCirclesOnly: { [weak coordinator] checked in
                guard let view = coordinator?.view, view.isEnabled else { return }
                view.$form.onlyMyCircles.wrappedValue = checked.boolValue
            },
            onHeight: { value in
                let measuredHeight = max(1, CGFloat(value.doubleValue))
                Task { @MainActor in
                    if currentHeight.wrappedValue != measuredHeight {
                        currentHeight.wrappedValue = measuredHeight
                    }
                }
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        update(context.coordinator)
    }

    private func update(_ coordinator: Coordinator) {
        coordinator.view = self
        coordinator.state.update(
            hosting: form.hosting.rawValue,
            meeting: form.meeting.rawValue,
            maxGuests: Int32(clamping: form.maxGuests),
            circlesOnly: form.onlyMyCircles,
            enabled: isEnabled
        )
    }
}
