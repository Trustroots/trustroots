import CryptoKit
import Foundation
import Security
#if canImport(NostrSDK)
import NostrSDK
#endif

enum NostrIdentityError: Error, LocalizedError {
    case invalidKey
    case missingKey
    case keychain(OSStatus)
    case unsupported

    var errorDescription: String? {
        switch self {
        case .invalidKey: return "Enter a valid nsec or 64-character private key."
        case .missingKey: return "Create or import a Nostr key first."
        case .keychain: return "The Nostr key could not be stored on this device."
        case .unsupported: return "Nostr signing support is not available in this build."
        }
    }
}

@MainActor
final class NostrIdentityManager: ObservableObject {
    static let shared = NostrIdentityManager()

    @Published private(set) var publicKey: String?
    @Published private(set) var npub: String?
    private let keyStore = NostrKeyStore()

    private init() {
        refresh()
    }

    var hasKey: Bool { publicKey != nil }

    func generate() throws {
        try keyStore.save(secret: NostrKeyCodec.generateSecret())
        NIP07PermissionStore.shared.clear()
        refresh()
    }

    func `import`(_ input: String) throws {
        try keyStore.save(secret: NostrKeyCodec.importSecret(input))
        NIP07PermissionStore.shared.clear()
        refresh()
    }

    func remove() throws {
        try keyStore.remove()
        NIP07PermissionStore.shared.clear()
        refresh()
    }

    func refresh() {
        publicKey = keyStore.secret.flatMap { try? NostrCrypto.publicKey(secret: $0) }
        npub = publicKey.flatMap { NostrCrypto.npub(publicKey: $0) }
    }

    func secret() -> String? { keyStore.secret }
}

private final class NostrKeyStore {
    private let service = "org.trustroots.ios.nostr"
    private let account = "nip07.private-key.hex"
    private var simulatorFallbackKey: String { "\(service).\(account).simulator-fallback" }

    var secret: String? {
        var query = lookup
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data {
            return String(data: data, encoding: .utf8)
        }
        #if targetEnvironment(simulator)
        return UserDefaults.standard.string(forKey: simulatorFallbackKey)
        #else
        return nil
        #endif
    }

    func save(secret: String) throws {
        let data = Data(secret.utf8)
        let status = SecItemCopyMatching(lookup as CFDictionary, nil)
        if status == errSecSuccess {
            let update = SecItemUpdate(lookup as CFDictionary, [kSecValueData as String: data] as CFDictionary)
            guard update == errSecSuccess else {
                try saveSimulatorFallback(secret, status: update)
                return
            }
            return
        }
        var attributes = lookup
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let create = SecItemAdd(attributes as CFDictionary, nil)
        guard create == errSecSuccess else {
            try saveSimulatorFallback(secret, status: create)
            return
        }
    }

    func remove() throws {
        let status = SecItemDelete(lookup as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            #if targetEnvironment(simulator)
            UserDefaults.standard.removeObject(forKey: simulatorFallbackKey)
            return
            #else
            throw NostrIdentityError.keychain(status)
            #endif
        }
        #if targetEnvironment(simulator)
        UserDefaults.standard.removeObject(forKey: simulatorFallbackKey)
        #endif
    }

    private func saveSimulatorFallback(_ secret: String, status: OSStatus) throws {
        #if targetEnvironment(simulator)
        UserDefaults.standard.set(secret, forKey: simulatorFallbackKey)
        #else
        throw NostrIdentityError.keychain(status)
        #endif
    }

    private var lookup: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

enum NostrKeyCodec {
    private static let charset = Array("qpzry9x8gf2tvdw0s3jn54khce6mua7l")

    static func generateSecret() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    static func importSecret(_ raw: String) throws -> String {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if isSecretHex(value) { return value }
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
        guard isSecretHex(secret) else { throw NostrIdentityError.invalidKey }
        return secret
    }

    static func isSecretHex(_ value: String) -> Bool {
        value.count == 64 && value.range(of: "^[0-9a-f]+$", options: .regularExpression) != nil
    }

    private static func convertBits(_ values: [UInt8], from: Int, to: Int, pad: Bool) -> [UInt8] {
        var accumulator = 0
        var bits = 0
        let maxValue = (1 << to) - 1
        var output: [UInt8] = []
        for value in values {
            accumulator = (accumulator << from) | Int(value)
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
private struct NostrSDKBridgeCrypto: ContentSigning, NIP44v2Encrypting, LegacyDirectMessageEncrypting {}
#endif
