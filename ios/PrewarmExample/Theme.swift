import SwiftUI

/// The palette of the original Petify example app, shared by the iOS, Android,
/// React Native and Flutter examples.
enum Theme {
    static let appBg = Color(hex: 0xF3F3F4)
    static let surface = Color(hex: 0xFFFFFF)
    static let main = Color(hex: 0xFF592C)
    static let mainPressed = Color(hex: 0xCE4926)
    static let actionCard = Color(hex: 0x5476CD)
    static let brand = Color(hex: 0x0033B5)
    static let surfaceTint = Color(hex: 0xE8EDF9)
    static let ink = Color(hex: 0x111111)
    static let inkMuted = Color(hex: 0x4B5563)
    static let inkFaint = Color(hex: 0x9CA3AF)
    static let hairline = Color(hex: 0xE5E7EB)
    static let success = Color(hex: 0x2FC869)
    static let error = Color(hex: 0xFF323E)
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
}

/// Filled main-colour button: the primary action of a screen.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.medium))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(configuration.isPressed ? Theme.mainPressed : Theme.main,
                        in: RoundedRectangle(cornerRadius: 12))
            .opacity(isEnabled ? 1 : 0.4)
    }
}

/// Outlined main-colour button: the secondary action.
struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.medium))
            .foregroundStyle(Theme.main)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(RoundedRectangle(cornerRadius: 12).stroke(Theme.main))
            .opacity(isEnabled ? (configuration.isPressed ? 0.6 : 1) : 0.4)
    }
}

/// A white card with an icon-and-title header.
struct Card<Content: View>: View {
    let title: String
    let systemImage: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Image(systemName: systemImage).foregroundStyle(Theme.main)
                Text(title).foregroundStyle(Theme.ink)
            }
            .font(.title3.bold())
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }
}
