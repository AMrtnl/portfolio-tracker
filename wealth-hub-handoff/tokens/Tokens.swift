import SwiftUI

/// Wealth Hub design tokens. Colours resolve by colour scheme, so nothing in the app picks light or dark by hand.
enum WH {
    static func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
        #if os(iOS)
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
        #else
        Color(NSColor(name: nil) { $0.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(hex: dark) : NSColor(hex: light) })
        #endif
    }
    static let marble = dyn(0xFBF6EA, 0x080C22), panel = dyn(0xF2ECDC, 0x0D1230), card = dyn(0xFFFFFF, 0x141A3A), rule = dyn(0xE9E0CB, 0x232B55)
    static let ink = dyn(0x0C1230, 0xEEF1FF), muted = dyn(0x5B6076, 0x9AA3CC)
    static let ultra = dyn(0x1F3FD0, 0x4A6CF0), ultraSoft = dyn(0xE6EBFB, 0x1B2350)
    static let stone = dyn(0xE2B23C, 0xE2B23C), stoneSoft = dyn(0xFBF0D2, 0x3A2F12)
    static let gain = dyn(0x157A52, 0x4ADE9A), gainSoft = dyn(0xDDF1E7, 0x123A2C)
    static let owed = dyn(0xB5301B, 0xFF8A6B), owedSoft = dyn(0xFBE3DD, 0x3A1D19)
    enum Radius { static let card: CGFloat = 28, field: CGFloat = 16, listItem: CGFloat = 14 }
    static func serif(_ size: CGFloat) -> Font { .custom("InstrumentSerif-Regular", size: size) }
    static func sans(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font { .custom("DM Sans", size: size).weight(weight) }
}

/// A surface that is dark regardless of the system scheme (the ultramarine Grow card, a photo) says so once.
private struct GroundKey: EnvironmentKey { static let defaultValue: ColorScheme? = nil }
extension EnvironmentValues { var whGround: ColorScheme? { get { self[GroundKey.self] } set { self[GroundKey.self] = newValue } } }
extension View { func whGround(_ g: ColorScheme) -> some View { environment(\.whGround, g) } }

/// The logo. One view, no variant parameter. It reads the ground and its own size and picks the right cut.
struct MarkView: View {
    var width: CGFloat
    @Environment(\.colorScheme) private var scheme
    @Environment(\.whGround) private var ground
    var body: some View {
        let dark = (ground ?? scheme) == .dark
        let weight = width >= 260 ? "l" : width >= 110 ? "m" : width >= 48 ? "s" : "xs"
        Image("wh-l3-\(weight)-\(dark ? "dark" : "light")")   // add the 8 SVGs to the asset catalog, "Preserve Vector Data" on
            .resizable().frame(width: width, height: width * 0.8)
            .accessibilityLabel("Wealth Hub")
    }
}
// UIColor(hex:) / NSColor(hex:) are the usual three-line helpers.
