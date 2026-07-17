import CryptoKit
import Foundation

struct CachedHTTPResponse: Codable, Equatable {
    let data: Data
    let savedAt: Date
}

actor OfflineResponseCache {
    static let shared = OfflineResponseCache()
    static let scopeDefaultsKey = "trustroots.offlineCacheScope"

    private let directory: URL

    init(directory: URL? = nil) {
        if let directory {
            self.directory = directory
        } else {
            let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            self.directory = applicationSupport.appendingPathComponent("Trustroots/ResponseCache", isDirectory: true)
        }
    }

    func save(_ data: Data, for url: URL) throws {
        guard let fileURL = fileURL(for: url) else { return }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let encoded = try JSONEncoder().encode(CachedHTTPResponse(data: data, savedAt: .now))
        try encoded.write(to: fileURL, options: [.atomic, .completeFileProtection])
    }

    func response(for url: URL) -> CachedHTTPResponse? {
        guard let fileURL = fileURL(for: url),
              let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(CachedHTTPResponse.self, from: data)
    }

    func clear() {
        try? FileManager.default.removeItem(at: directory)
    }

    private func fileURL(for url: URL) -> URL? {
        guard let scope = UserDefaults.standard.string(forKey: Self.scopeDefaultsKey), !scope.isEmpty else {
            return nil
        }
        let digest = SHA256.hash(data: Data("\(scope)|\(url.absoluteString)".utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return directory.appendingPathComponent("\(digest).json")
    }
}

@MainActor
final class OfflineAvailability: ObservableObject {
    static let shared = OfflineAvailability()

    @Published private(set) var isUsingSavedData = false
    @Published private(set) var savedAt: Date?

    func showSavedData(from date: Date) {
        isUsingSavedData = true
        savedAt = date
    }

    func showLiveData() {
        isUsingSavedData = false
        savedAt = nil
    }
}
