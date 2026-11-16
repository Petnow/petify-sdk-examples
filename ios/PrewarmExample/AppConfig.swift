import Foundation
import PetnowUI

/// Values from Config/Secrets.xcconfig, carried into Info.plist at build time.
enum AppConfig {
    /// Nil until PETNOW_API_KEY is set in Config/Secrets.xcconfig.
    static let apiKey: String? = value("PetnowAPIKey", placeholder: "YOUR_PETNOW_API_KEY")

    static var license: LicenseInfo? { apiKey.map { LicenseInfo(apiKey: $0) } }

    /// EXAMPLE_SERVER_HOST — host:port only. xcconfig reads `//` as a comment, so the
    /// scheme is added here. Nil when unset or not a host:port.
    static let serverURL: URL? = {
        guard let host = value("ExampleServerHost"),
              !host.contains("/"), !host.hasSuffix(":"),   // "http://…" arrives cut to "http:"
              let url = URL(string: "http://\(host)"), url.host != nil else { return nil }
        return url
    }()

    /// EXAMPLE_SERVER_TOKEN — sent as a bearer token; never shown or logged.
    static let serverToken: String? = value("ExampleServerToken", placeholder: "TOKEN_PRINTED_BY_THE_SERVER")

    /// Server mode: both set. Otherwise camera-only mode.
    static var isServerMode: Bool { serverURL != nil && serverToken != nil }

    /// Something was set for the server, but not both values (or not a host:port).
    static var serverConfigIncomplete: Bool {
        !isServerMode && (value("ExampleServerHost") != nil || serverToken != nil)
    }

    private static func value(_ key: String, placeholder: String? = nil) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty, value != placeholder, !value.hasPrefix("$(") else { return nil }
        return value
    }
}
