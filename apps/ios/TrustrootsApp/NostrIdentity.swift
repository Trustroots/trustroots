import CryptoKit
import Foundation
import Security
import LocalAuthentication
import TrustrootsShared
#if canImport(NostrSDK)
import NostrSDK
#endif

enum NostrIdentityError: Error, LocalizedError {
    case invalidKey
    case missingKey
    case keychain(OSStatus)
    case unsupported
    case inactiveSession
    case existingKey
    case authenticationUnavailable

    var errorDescription: String? {
        switch self {
        case .invalidKey: return "Enter a valid nsec or 64-character private key."
        case .missingKey: return "Create or import a Nostr key first."
        case .keychain: return "The Nostr key could not be stored on this device."
        case .unsupported: return "Nostr signing support is not available in this build."
        case .inactiveSession: return "Sign in again before using your Nostr key."
        case .existingKey: return "Remove the current local key before creating or claiming another."
        case .authenticationUnavailable: return "Set up a device passcode to back up your Nostr key."
        }
    }
}

// A narrow native port keeps Keychain outside shared Kotlin and makes failures testable.
protocol NostrKeyStorage {
    func read(account: String) throws -> String?
    func save(secret: String, account: String) throws
    func remove(account: String) throws
}

@MainActor
final class NostrIdentityManager: ObservableObject {
    static let shared = NostrIdentityManager()
    static let legacyAccount = "nip07.private-key.hex"
    static let legacyOwnerAccount = legacyAccount + ".owner-v1"

    @Published private(set) var publicKey: String?
    @Published private(set) var npub: String?
    @Published private(set) var legacyNpub: String?
    @Published private(set) var errorMessage: String?
    @Published private(set) var revision: Int64 = 0
    private let signingSession = NostrSigningSession()
    private let keyStore: NostrKeyStorage
    private let clearPermissions: () -> Void

    init(
        keyStore: NostrKeyStorage = NostrKeyStore(),
        clearPermissions: @escaping () -> Void = { NIP07PermissionStore.shared.clear() }
    ) {
        self.keyStore = keyStore
        self.clearPermissions = clearPermissions
    }

    var hasKey: Bool { publicKey != nil }
    var isActive: Bool { signingSession.scope != nil }
    var accountScope: NostrAccountScope? { signingSession.scope }

    func activate(serverURLString: String, username: String) {
        guard let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString),
              var origin = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false),
              !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            pause()
            return
        }
        origin.scheme = origin.scheme?.lowercased()
        origin.path = ""
        origin.query = nil
        origin.fragment = nil
        // Explicit default ports identify the same server as their omitted form.
        if (origin.scheme == "https" && origin.port == 443) || (origin.scheme == "http" && origin.port == 80) {
            origin.port = nil
        }
        guard let server = origin.string else { pause(); return }
        let account = NostrAccountScope(serverOrigin: server, username: username)
        if signingSession.activate(account: account) {
            identityChanged()
            refresh()
        }
    }

    func pause() {
        signingSession.pause()
        identityChanged()
        publicKey = nil
        npub = nil
        legacyNpub = nil
        errorMessage = nil
    }

    func isCurrent(_ capturedRevision: Int64) -> Bool {
        signingSession.isCurrent(capturedRevision: capturedRevision)
    }

    func generate() throws {
        try storeNewSecret(NostrKeyCodec.generateSecret())
    }

    func `import`(_ input: String) throws {
        try storeNewSecret(NostrKeyCodec.importSecret(input))
    }

    private func storeNewSecret(_ secret: String) throws {
        let account = try activeAccount()
        guard try keyStore.read(account: account) == nil else { throw NostrIdentityError.existingKey }
        // Reject out-of-range scalars before storing, including all-zero hex imports.
        _ = try NostrCrypto.publicKey(secret: secret)
        try keyStore.save(secret: secret, account: account)
        signingSession.invalidate()
        identityChanged()
        refresh()
    }

    func remove() throws {
        let account = try activeAccount()
        try keyStore.remove(account: Self.pairingAccount(account))
        try keyStore.remove(account: account)
        signingSession.invalidate()
        identityChanged()
        refresh()
    }

    static func pairingAccount(_ account: String) -> String { "nostranslation:\(account)" }

    func claimLegacy() throws {
        let account = try activeAccount()
        guard try keyStore.read(account: account) == nil else { throw NostrIdentityError.existingKey }
        let owner = try keyStore.read(account: Self.legacyOwnerAccount)
        guard owner == nil || owner == account else { throw NostrIdentityError.existingKey }
        guard let legacy = try keyStore.read(account: Self.legacyAccount) else { throw NostrIdentityError.missingKey }
        _ = try NostrCrypto.publicKey(secret: legacy)
        // Reserve ownership first, so interruption/deletion failure cannot let another
        // account claim the same installation key. The owner can retry a failed copy.
        if owner == nil { try keyStore.save(secret: account, account: Self.legacyOwnerAccount) }
        try keyStore.save(secret: legacy, account: account)
        // The scoped copy is durable before the only old copy can be removed.
        signingSession.invalidate()
        identityChanged()
        do {
            try keyStore.remove(account: Self.legacyAccount)
        } catch {
            refresh()
            throw error
        }
        refresh()
    }

    func considerLegacy(linkedNpub: String?, capturedRevision: Int64) throws {
        guard isCurrent(capturedRevision), !hasKey,
              let linkedNpub, linkedNpub == legacyNpub else { return }
        try claimLegacy()
    }

    func refresh() {
        publicKey = nil
        npub = nil
        legacyNpub = nil
        errorMessage = nil
        guard let account = signingSession.scope?.storageAccount else { return }
        do {
            if let secret = try keyStore.read(account: account) {
                publicKey = try NostrCrypto.publicKey(secret: secret)
                npub = publicKey.flatMap { NostrCrypto.npub(publicKey: $0) }
            } else {
                let owner = try keyStore.read(account: Self.legacyOwnerAccount)
                if owner == nil || owner == account,
                   let legacy = try keyStore.read(account: Self.legacyAccount) {
                    legacyNpub = NostrCrypto.npub(publicKey: try NostrCrypto.publicKey(secret: legacy))
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func secret() -> String? {
        guard hasKey, let account = signingSession.scope?.storageAccount else { return nil }
        return try? keyStore.read(account: account)
    }

    func backup(
        authenticate: (@MainActor () async throws -> Void)? = nil
    ) async throws -> String {
        let capturedRevision = revision
        guard hasKey, isCurrent(capturedRevision) else { throw NostrIdentityError.missingKey }
        if let authenticate { try await authenticate() }
        else { try await Self.authenticateOwner() }
        try Task.checkCancellation()
        guard isCurrent(capturedRevision), let secret = secret() else { throw NostrIdentityError.inactiveSession }
        return try NostrKeyCodec.nsec(secret: secret)
    }

    private static func authenticateOwner() async throws {
        let context = LAContext()
        defer { context.invalidate() }
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            throw NostrIdentityError.authenticationUnavailable
        }
        guard try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Back up your Nostr private key") else {
            throw NostrIdentityError.authenticationUnavailable
        }
    }

    private func activeAccount() throws -> String {
        guard let account = signingSession.scope?.storageAccount else { throw NostrIdentityError.inactiveSession }
        return account
    }

    private func identityChanged() {
        revision = signingSession.revision
        clearPermissions()
    }
}

final class NostrKeyStore: NostrKeyStorage {
    private let service = "org.trustroots.trustrootsApp.nostr"

    func read(account: String) throws -> String? {
        var query = lookup(account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data,
              let secret = String(data: data, encoding: .utf8) else { throw NostrIdentityError.keychain(status) }
        return secret
    }

    func save(secret: String, account: String) throws {
        var attributes = lookup(account)
        attributes[kSecValueData as String] = Data(secret.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(attributes as CFDictionary, nil)
        // Writes are insert-only: neither a failed read nor a migration may replace a key.
        guard status == errSecSuccess else { throw NostrIdentityError.keychain(status) }
    }

    func remove(account: String) throws {
        let status = SecItemDelete(lookup(account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw NostrIdentityError.keychain(status) }
    }

    func update(secret: String, account: String) throws {
        let attributes = [kSecValueData as String: Data(secret.utf8)]
        let status = SecItemUpdate(lookup(account) as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            try save(secret: secret, account: account)
        } else if status != errSecSuccess {
            throw NostrIdentityError.keychain(status)
        }
    }

    private func lookup(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

enum NostrKeyCodec {
    private static let charset = Array("qpzry9x8gf2tvdw0s3jn54khce6mua7l")

    static func generateSecret() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        // SecRandom failures must never create a predictable identity.
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else { throw NostrIdentityError.keychain(status) }
        let secret = bytes.map { String(format: "%02x", $0) }.joined()
        _ = try NostrCrypto.publicKey(secret: secret)
        return secret
    }

    static func importSecret(_ raw: String) throws -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let value = trimmed.lowercased()
        if isSecretHex(value) {
            _ = try NostrCrypto.publicKey(secret: value)
            return value
        }
        guard trimmed == value || trimmed == trimmed.uppercased() else { throw NostrIdentityError.invalidKey }
        guard value.hasPrefix("nsec1"), let separator = value.lastIndex(of: "1") else {
            throw NostrIdentityError.invalidKey
        }
        let dataPart = value[value.index(after: separator)...]
        var mapping: [Character: UInt8] = [:]
        for (index, character) in charset.enumerated() { mapping[character] = UInt8(index) }
        let optionalValues = dataPart.map { mapping[$0] }
        guard !optionalValues.contains(where: { $0 == nil }) else {
            throw NostrIdentityError.invalidKey
        }
        let values = optionalValues.compactMap { $0 }
        guard values.count > 6, verifyChecksum(hrp: "nsec", values: values) else {
            throw NostrIdentityError.invalidKey
        }
        let bytes = convertBits(Array(values.dropLast(6)), from: 5, to: 8, pad: false)
        let secret = bytes.map { String(format: "%02x", $0) }.joined()
        guard values.count == 58, isSecretHex(secret),
              Array(values.dropLast(6)) == convertBits(bytes, from: 8, to: 5, pad: true) else { throw NostrIdentityError.invalidKey }
        _ = try NostrCrypto.publicKey(secret: secret)
        return secret
    }

    static func isSecretHex(_ value: String) -> Bool {
        value.count == 64 && value.range(of: "^[0-9a-f]+$", options: .regularExpression) != nil
    }

    static func nsec(secret: String) throws -> String {
        guard isSecretHex(secret) else { throw NostrIdentityError.invalidKey }
        _ = try NostrCrypto.publicKey(secret: secret)
        let bytes = stride(from: 0, to: secret.count, by: 2).map { offset -> UInt8 in
            let start = secret.index(secret.startIndex, offsetBy: offset)
            return UInt8(secret[start..<secret.index(start, offsetBy: 2)], radix: 16)!
        }
        let values = convertBits(bytes, from: 8, to: 5, pad: true)
        let checksum = polymod(expand("nsec") + values + Array(repeating: 0, count: 6)) ^ 1
        let suffix = (0..<6).map { UInt8((checksum >> (5 * (5 - $0))) & 31) }
        return "nsec1" + String((values + suffix).map { charset[Int($0)] })
    }

    private static func convertBits(_ values: [UInt8], from: Int, to: Int, pad: Bool) -> [UInt8] {
        var accumulator = 0
        var bits = 0
        let maxValue = (1 << to) - 1
        var output: [UInt8] = []
        for value in values {
            accumulator = ((accumulator << from) | Int(value)) & ((1 << (from + to - 1)) - 1)
            bits += from
            while bits >= to {
                bits -= to
                output.append(UInt8((accumulator >> bits) & maxValue))
            }
        }
        if pad && bits > 0 { output.append(UInt8((accumulator << (to - bits)) & maxValue)) }
        return output
    }

    private static func verifyChecksum(hrp: String, values: [UInt8]) -> Bool {
        polymod(expand(hrp) + values) == 1
    }

    private static func expand(_ hrp: String) -> [UInt8] {
        hrp.unicodeScalars.map { UInt8($0.value >> 5) } + [0] + hrp.unicodeScalars.map { UInt8($0.value & 31) }
    }

    private static func polymod(_ values: [UInt8]) -> UInt32 {
        let generators: [UInt32] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
        var checksum: UInt32 = 1
        for value in values {
            let top = checksum >> 25
            checksum = ((checksum & 0x1ffffff) << 5) ^ UInt32(value)
            for index in 0..<5 where ((top >> index) & 1) == 1 { checksum ^= generators[index] }
        }
        return checksum
    }
}

enum NostrCrypto {
    static func publicKey(secret: String) throws -> String {
        #if canImport(NostrSDK)
        guard let keypair = NostrSDK.Keypair(hex: secret) else { throw NostrIdentityError.invalidKey }
        return keypair.publicKey.hex
        #else
        _ = secret
        throw NostrIdentityError.unsupported
        #endif
    }

    static func npub(publicKey: String) -> String? {
        #if canImport(NostrSDK)
        return NostrSDK.PublicKey(hex: publicKey)?.npub
        #else
        _ = publicKey
        return nil
        #endif
    }

    static func signEventID(_ eventID: String, secret: String) throws -> String {
        #if canImport(NostrSDK)
        guard NostrSDK.PrivateKey(hex: secret) != nil else { throw NostrIdentityError.invalidKey }
        return try NostrSDKBridgeCrypto().signatureForContent(eventID, privateKey: secret)
        #else
        _ = eventID
        _ = secret
        throw NostrIdentityError.unsupported
        #endif
    }

    static func verifyEventID(_ eventID: String, signature: String, publicKey: String) throws {
        #if canImport(NostrSDK)
        try NostrSDKBridgeCrypto().verifySignature(signature, for: eventID, withPublicKey: publicKey)
        #else
        throw NostrIdentityError.unsupported
        #endif
    }

    static func nip44Encrypt(_ text: String, secret: String, peer: String) throws -> String {
        #if canImport(NostrSDK)
        guard let privateKey = NostrSDK.PrivateKey(hex: secret), let publicKey = NostrSDK.PublicKey(hex: peer) else { throw NostrIdentityError.invalidKey }
        return try NostrSDKBridgeCrypto().encrypt(plaintext: text, privateKeyA: privateKey, publicKeyB: publicKey)
        #else
        _ = text; _ = secret; _ = peer
        throw NostrIdentityError.unsupported
        #endif
    }

    static func nip44Decrypt(_ text: String, secret: String, peer: String) throws -> String {
        #if canImport(NostrSDK)
        guard let privateKey = NostrSDK.PrivateKey(hex: secret), let publicKey = NostrSDK.PublicKey(hex: peer) else { throw NostrIdentityError.invalidKey }
        return try NostrSDKBridgeCrypto().decrypt(payload: text, privateKeyA: privateKey, publicKeyB: publicKey)
        #else
        _ = text; _ = secret; _ = peer
        throw NostrIdentityError.unsupported
        #endif
    }

    static func nip04Encrypt(_ text: String, secret: String, peer: String) throws -> String {
        #if canImport(NostrSDK)
        guard let privateKey = NostrSDK.PrivateKey(hex: secret), let publicKey = NostrSDK.PublicKey(hex: peer) else { throw NostrIdentityError.invalidKey }
        return try NostrSDKBridgeCrypto().legacyEncrypt(content: text, privateKey: privateKey, publicKey: publicKey)
        #else
        _ = text; _ = secret; _ = peer
        throw NostrIdentityError.unsupported
        #endif
    }

    static func nip04Decrypt(_ text: String, secret: String, peer: String) throws -> String {
        #if canImport(NostrSDK)
        guard let privateKey = NostrSDK.PrivateKey(hex: secret), let publicKey = NostrSDK.PublicKey(hex: peer) else { throw NostrIdentityError.invalidKey }
        return try NostrSDKBridgeCrypto().legacyDecrypt(encryptedContent: text, privateKey: privateKey, publicKey: publicKey)
        #else
        _ = text; _ = secret; _ = peer
        throw NostrIdentityError.unsupported
        #endif
    }
}

#if canImport(NostrSDK)
private struct NostrSDKBridgeCrypto: ContentSigning, SignatureVerifying, NIP44v2Encrypting, LegacyDirectMessageEncrypting {}
#endif
