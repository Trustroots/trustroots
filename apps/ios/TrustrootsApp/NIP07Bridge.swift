import CryptoKit
import Foundation

struct NIP07PermissionPrompt: Identifiable {
    let id = UUID()
    let host: String
    let allow: (_ remember: Bool) -> Void
    let deny: () -> Void
}

final class NIP07PermissionStore {
    static let shared = NIP07PermissionStore()
    private let key = "org.trustroots.ios.nip07.allowed-origins"

    func isAllowed(_ origin: String) -> Bool {
        Set(UserDefaults.standard.stringArray(forKey: key) ?? []).contains(origin)
    }

    func allow(_ origin: String) {
        var origins = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
        origins.insert(origin)
        UserDefaults.standard.set(origins.sorted(), forKey: key)
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

enum NIP07Bridge {
    static let scriptHandlerName = "trustrootsNip7"
    static let supportedMethods: Set<String> = [
        "getPublicKey", "signEvent", "nip44.encrypt", "nip44.decrypt", "nip04.encrypt", "nip04.decrypt"
    ]

    static let injectedScript = """
    (function() {
      if (window.nostr && window.nostr.__trustrootsIOS) return;
      var pending = {};
      var sequence = 0;
      function request(method, params) {
        return new Promise(function(resolve, reject) {
          var id = 'trustroots-ios-' + Date.now() + '-' + (++sequence);
          pending[id] = { resolve: resolve, reject: reject };
          window.webkit.messageHandlers.trustrootsNip7.postMessage({
            source: 'trustroots-ios-nip7', id: id, method: method, params: params || []
          });
        });
      }
      window.__trustrootsNip7Receive = function(response) {
        var callback = pending[response.id];
        if (!callback) return;
        delete pending[response.id];
        if (response.ok) callback.resolve(response.result);
        else callback.reject(new Error(response.error || 'Nostr operation was denied.'));
      };
      window.nostr = {
        __trustrootsIOS: true,
        getPublicKey: function() { return request('getPublicKey', []); },
        signEvent: function(event) { return request('signEvent', [event]); },
        nip44: {
          encrypt: function(peer, text) { return request('nip44.encrypt', [peer, text]); },
          decrypt: function(peer, text) { return request('nip44.decrypt', [peer, text]); }
        },
        nip04: {
          encrypt: function(peer, text) { return request('nip04.encrypt', [peer, text]); },
          decrypt: function(peer, text) { return request('nip04.decrypt', [peer, text]); }
        }
      };
    })();
    """

    static func trustedOrigin(for url: URL?) -> String? {
        guard let url,
              url.scheme?.lowercased() == "https",
              let host = url.host?.lowercased(),
              isTrustedHost(host) else {
            return nil
        }
        let port = url.port.map { ":\($0)" } ?? ""
        return "https://\(host)\(port)"
    }

    static func isAutomaticallyAllowed(_ origin: String) -> Bool {
        guard let url = URL(string: origin),
              url.scheme?.lowercased() == "https",
              let host = url.host?.lowercased() else {
            return false
        }
        return isTrustedHost(host)
    }

    static func isTrustedHost(_ host: String) -> Bool {
        host == "trustroots.org" ||
            host.hasSuffix(".trustroots.org") ||
            host == "hitchwiki.org" ||
            host.hasSuffix(".hitchwiki.org")
    }

    static func metadata(from raw: Any) -> (id: String, method: String, params: Any?)? {
        guard let message = raw as? [String: Any],
              message["source"] as? String == "trustroots-ios-nip7",
              let id = message["id"] as? String,
              let method = message["method"] as? String else { return nil }
        return (id, method, message["params"])
    }

    static func response(id: String, result: Any? = nil, error: String? = nil) -> [String: Any] {
        var response: [String: Any] = ["id": id, "ok": error == nil]
        if let result { response["result"] = result }
        if let error { response["error"] = error }
        return response
    }

    @MainActor
    static func handle(id: String, method: String, params: Any?, identity: NostrIdentityManager) -> [String: Any] {
        guard supportedMethods.contains(method), let secret = identity.secret() else {
            return response(id: id, error: method == "getPublicKey" ? NostrIdentityError.missingKey.localizedDescription : "This Nostr operation is unavailable.")
        }
        do {
            switch method {
            case "getPublicKey":
                return response(id: id, result: try NostrCrypto.publicKey(secret: secret))
            case "signEvent":
                guard let event = (params as? [Any])?.first as? [String: Any] else { throw NostrIdentityError.invalidKey }
                return response(id: id, result: try sign(event: event, secret: secret))
            case "nip44.encrypt", "nip44.decrypt", "nip04.encrypt", "nip04.decrypt":
                guard let values = params as? [Any], values.count == 2,
                      let peer = values[0] as? String, let text = values[1] as? String,
                      NostrKeyCodec.isSecretHex(peer) else { throw NostrIdentityError.invalidKey }
                let result: String
                switch method {
                case "nip44.encrypt": result = try NostrCrypto.nip44Encrypt(text, secret: secret, peer: peer)
                case "nip44.decrypt": result = try NostrCrypto.nip44Decrypt(text, secret: secret, peer: peer)
                case "nip04.encrypt": result = try NostrCrypto.nip04Encrypt(text, secret: secret, peer: peer)
                default: result = try NostrCrypto.nip04Decrypt(text, secret: secret, peer: peer)
                }
                return response(id: id, result: result)
            default:
                return response(id: id, error: "Unsupported NIP-07 operation.")
            }
        } catch {
            return response(id: id, error: error.localizedDescription)
        }
    }

    private static func sign(event: [String: Any], secret: String) throws -> [String: Any] {
        guard let kind = number(event["kind"]), let content = event["content"] as? String,
              let tags = tags(event["tags"]) else { throw NostrIdentityError.invalidKey }
        let publicKey = try NostrCrypto.publicKey(secret: secret)
        let createdAt = number(event["created_at"]) ?? Int(Date().timeIntervalSince1970)
        let payload: [Any] = [0, publicKey, createdAt, kind, tags, content]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.withoutEscapingSlashes])
        let eventID = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        return [
            "id": eventID, "pubkey": publicKey, "created_at": createdAt,
            "kind": kind, "tags": tags, "content": content,
            "sig": try NostrCrypto.signEventID(eventID, secret: secret)
        ]
    }

    private static func number(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? NSNumber { return value.intValue }
        return nil
    }

    private static func tags(_ value: Any?) -> [[String]]? {
        guard let rawTags = value as? [Any] else { return nil }
        var converted: [[String]] = []
        for raw in rawTags {
            guard let parts = raw as? [Any] else { return nil }
            let tag = parts.compactMap { $0 as? String }
            guard tag.count == parts.count else { return nil }
            converted.append(tag)
        }
        return converted
    }
}
