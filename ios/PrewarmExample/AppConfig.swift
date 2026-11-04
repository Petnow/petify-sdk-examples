import Foundation
import PetnowUI

/// Values from Config/Secrets.xcconfig, carried into Info.plist at build time.
enum AppConfig {
    /// Nil until PETNOW_API_KEY is set in Config/Secrets.xcconfig.
    static let apiKey: String? = {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "PetnowAPIKey") as? String,
              !key.isEmpty, key != "YOUR_PETNOW_API_KEY", !key.hasPrefix("$(") else { return nil }
        return key
    }()

    static var license: LicenseInfo? { apiKey.map { LicenseInfo(apiKey: $0) } }
}
