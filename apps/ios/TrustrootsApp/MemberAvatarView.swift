import SwiftUI

struct MemberAvatarView: View {
    let memberID: String?
    let displayName: String
    let serverURLString: String
    var size: CGFloat = 48

    var body: some View {
        Group {
            if let memberID,
               let configuration = TrustrootsAPIConfiguration(baseURLString: serverURLString),
               let url = URL(string: "\(configuration.normalizedURLString)/uploads-profile/\(memberID)/avatar/128.jpg") {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .background(TrustrootsPalette.paleGreen)
        .clipShape(Circle())
    }

    private var fallback: some View {
        Text(initials)
            .font(.system(size: size * 0.34, weight: .bold, design: .rounded))
            .foregroundStyle(TrustrootsPalette.darkGreen)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var initials: String {
        let words = displayName.split(separator: " ")
        let initials = words.prefix(2).compactMap(\.first)
        return initials.isEmpty ? "?" : String(initials).uppercased()
    }
}
