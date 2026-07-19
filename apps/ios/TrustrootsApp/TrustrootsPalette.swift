import SwiftUI

enum TrustrootsPalette {
    static let green = Color(red: 18 / 255, green: 181 / 255, blue: 145 / 255)
    static let darkGreen = Color(red: 10 / 255, green: 139 / 255, blue: 112 / 255)
    static let paleGreen = Color(red: 236 / 255, green: 249 / 255, blue: 245 / 255)
    static let hostYes = Color(red: 88 / 255, green: 186 / 255, blue: 88 / 255)
    static let hostMaybe = Color(red: 242 / 255, green: 174 / 255, blue: 67 / 255)
    static let communityNote = Color(red: 21 / 255, green: 101 / 255, blue: 192 / 255)
}

extension Color {
    static func trustrootsHex(_ hex: String) -> Color {
        let normalized = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard let value = UInt64(normalized, radix: 16) else { return TrustrootsPalette.green }
        return Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
