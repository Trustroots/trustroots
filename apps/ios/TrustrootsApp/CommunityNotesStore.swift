import Combine
import CoreLocation
import Foundation
import NostrSDK

struct CommunityNote: Identifiable, Codable, Equatable {
    let id: String
    let content: String
    let createdAt: Date
    let latitude: Double
    let longitude: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

@MainActor
final class CommunityNotesStore: ObservableObject {
    static let relayURL = URL(string: "wss://relay.trustroots.org")!
    static let validatorPubkey = "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b"

    @Published private(set) var notes: [CommunityNote] = []
    @Published private(set) var errorMessage: String?

    private var socket: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private let subscriptionID = "trustroots-ios-community-notes"

    func connect() {
        guard socket == nil else { return }
        errorMessage = nil
        let socket = URLSession.shared.webSocketTask(with: Self.relayURL)
        self.socket = socket
        socket.resume()
        receiveTask = Task { [weak self] in
            guard let self else { return }
            await self.subscribe(on: socket)
            await self.receive(from: socket)
        }
    }

    func disconnect() {
        receiveTask?.cancel()
        receiveTask = nil
        socket?.cancel(with: .normalClosure, reason: nil)
        socket = nil
        notes = []
    }

    private func subscribe(on socket: URLSessionWebSocketTask) async {
        let request: [Any] = [
            "REQ",
            subscriptionID,
            ["kinds": [30398], "authors": [Self.validatorPubkey], "limit": 500]
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: request),
              let string = String(data: data, encoding: .utf8) else { return }
        try? await socket.send(.string(string))
    }

    private func receive(from socket: URLSessionWebSocketTask) async {
        while !Task.isCancelled {
            do {
                let message = try await socket.receive()
                let data: Data
                switch message {
                case .data(let value): data = value
                case .string(let value): data = Data(value.utf8)
                @unknown default: continue
                }
                if let note = Self.note(fromRelayMessage: data),
                   !notes.contains(where: { $0.id == note.id }) {
                    notes.append(note)
                }
            } catch {
                if !Task.isCancelled {
                    errorMessage = "Community Notes are temporarily unavailable."
                }
                break
            }
        }
    }

    static func note(fromRelayMessage data: Data) -> CommunityNote? {
        guard let message = try? JSONSerialization.jsonObject(with: data) as? [Any],
              message.count >= 3,
              message[0] as? String == "EVENT",
              let eventData = try? JSONSerialization.data(withJSONObject: message[2]),
              let event = try? JSONDecoder().decode(NostrEvent.self, from: eventData),
              event.kind.rawValue == 30398,
              event.pubkey == validatorPubkey,
              (try? NostrEventVerifier().verifyEvent(event)) != nil,
              let locationTag = event.tags.first(where: {
                  $0.name == "l" && $0.otherParameters.first == "open-location-code"
              }),
              let coordinate = OpenLocationCodeDecoder.coordinate(for: locationTag.value) else {
            return nil
        }
        return CommunityNote(
            id: event.id,
            content: event.content,
            createdAt: Date(timeIntervalSince1970: TimeInterval(event.createdAt)),
            latitude: coordinate.latitude,
            longitude: coordinate.longitude
        )
    }
}

private struct NostrEventVerifier: EventVerifying {}

enum OpenLocationCodeDecoder {
    private static let alphabet = Array("23456789CFGHJMPQRVWX")
    private static let pairResolutions = [20.0, 1.0, 0.05, 0.0025, 0.000125]

    static func coordinate(for code: String) -> CLLocationCoordinate2D? {
        let clean = code.uppercased().filter { $0 != "+" && $0 != "0" }
        guard clean.count >= 8 else { return nil }
        let characters = Array(clean)
        var latitude = -90.0
        var longitude = -180.0
        var latitudeResolution = 20.0
        var longitudeResolution = 20.0

        let pairCharacters = min(characters.count, 10)
        var index = 0
        while index + 1 < pairCharacters {
            let pairIndex = index / 2
            guard pairIndex < pairResolutions.count,
                  let latitudeDigit = alphabet.firstIndex(of: characters[index]),
                  let longitudeDigit = alphabet.firstIndex(of: characters[index + 1]) else { return nil }
            let resolution = pairResolutions[pairIndex]
            latitude += Double(latitudeDigit) * resolution
            longitude += Double(longitudeDigit) * resolution
            latitudeResolution = resolution
            longitudeResolution = resolution
            index += 2
        }

        if characters.count > 10 {
            for character in characters.dropFirst(10) {
                guard let digit = alphabet.firstIndex(of: character) else { return nil }
                latitudeResolution /= 5
                longitudeResolution /= 4
                latitude += Double(digit / 4) * latitudeResolution
                longitude += Double(digit % 4) * longitudeResolution
            }
        }

        let coordinate = CLLocationCoordinate2D(
            latitude: latitude + latitudeResolution / 2,
            longitude: longitude + longitudeResolution / 2
        )
        return CLLocationCoordinate2DIsValid(coordinate) ? coordinate : nil
    }
}
