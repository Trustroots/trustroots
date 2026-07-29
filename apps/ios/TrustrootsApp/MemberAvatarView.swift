import SwiftUI
import UIKit

struct MemberAvatarView: View {
    let memberID: String?
    let displayName: String
    let serverURLString: String
    var size: CGFloat = 48

    var body: some View {
        MemberAvatarImageView(
            memberID: memberID,
            displayName: displayName,
            serverURLString: serverURLString,
            fallbackFontSize: size * 0.34
        )
        .frame(width: size, height: size)
        .background(TrustrootsPalette.paleGreen)
        .clipShape(Circle())
    }
}

struct MemberAvatarImageView: View {
    let memberID: String?
    let displayName: String
    let serverURLString: String
    var fallbackFontSize: CGFloat = 32
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                fallback
            }
        }
        .task(id: avatarURL) {
            image = await loadAvatar()
        }
    }

    private var fallback: some View {
        Text(initials)
            .font(.system(size: fallbackFontSize, weight: .bold, design: .rounded))
            .foregroundStyle(TrustrootsPalette.darkGreen)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(TrustrootsPalette.paleGreen)
    }

    private var initials: String {
        let words = displayName.split(separator: " ")
        let initials = words.prefix(2).compactMap(\.first)
        return initials.isEmpty ? "?" : String(initials).uppercased()
    }

    private var avatarURL: URL? {
        guard let memberID,
              let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString) else {
            return nil
        }
        return configuration.baseURL
            .appendingPathComponent("api/users/\(memberID)/avatar")
            .appending(queryItems: [URLQueryItem(name: "size", value: "128")])
    }

    private func loadAvatar() async -> UIImage? {
        guard let avatarURL,
              let cookieHeader = SessionCredentialStore().load()?.cookieHeader else {
            return nil
        }
        var request = URLRequest(url: avatarURL)
        request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
        request.setValue("image/*", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await MemberAvatarSession.shared.data(for: request)
            guard let response = response as? HTTPURLResponse,
                  (200..<300).contains(response.statusCode) else {
                return nil
            }
            return UIImage(data: data)
        } catch {
            return nil
        }
    }
}

private enum MemberAvatarSession {
    private static let redirectDelegate = AvatarRedirectDelegate()

    static let shared: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpCookieStorage = nil
        return URLSession(
            configuration: configuration,
            delegate: redirectDelegate,
            delegateQueue: nil
        )
    }()
}

private final class AvatarRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        var safeRequest = request
        if request.url?.host?.lowercased() != task.originalRequest?.url?.host?.lowercased() {
            safeRequest.setValue(nil, forHTTPHeaderField: "Cookie")
        }
        completionHandler(safeRequest)
    }
}
