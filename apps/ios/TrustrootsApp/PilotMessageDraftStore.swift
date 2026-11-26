import CryptoKit
import Foundation

struct PilotMessageDraftStore {
    struct Key: Equatable {
        let server: String
        let username: String
        let recipientID: String
    }

    private let directory: URL

    init(directory: URL = URL.applicationSupportDirectory.appendingPathComponent("Trustroots/PilotMessageDrafts")) {
        self.directory = directory
        if FileManager.default.fileExists(atPath: directory.path) {
            try? excludeFromBackup()
        }
    }

    func load(_ key: Key) -> String {
        (try? String(contentsOf: fileURL(for: key), encoding: .utf8)) ?? ""
    }

    func save(_ text: String, for key: Key) throws {
        let file = try fileURL(for: key)
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            if FileManager.default.fileExists(atPath: file.path) {
                try FileManager.default.removeItem(at: file)
            }
            return
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try excludeFromBackup()
        try Data(text.utf8).write(to: file, options: [.atomic, .completeFileProtection])
    }

    private func excludeFromBackup() throws {
        var draftDirectory = directory
        var storage = URLResourceValues()
        storage.isExcludedFromBackup = true
        try draftDirectory.setResourceValues(storage)
    }

    private func fileURL(for key: Key) throws -> URL {
        let scope = try JSONEncoder().encode([key.server, key.username.lowercased(), key.recipientID])
        let digest = SHA256.hash(data: scope).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(digest, isDirectory: false)
    }
}
