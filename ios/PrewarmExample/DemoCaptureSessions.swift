import Foundation

/// EXAMPLE ONLY — do not ship this.
///
/// In a real integration your **server** creates the capture session with the
/// Petify Server API and hands the app nothing but its ID. The app should never
/// need to call this endpoint. It is here so the example runs without a backend.
///
/// The session is for identification so that running the example does not
/// create pets in your account.
enum DemoCaptureSessions {
    struct ServerError: LocalizedError {
        let status: Int
        var errorDescription: String? { "Petify API returned HTTP \(status). Check PETNOW_API_KEY." }
    }

    static func create() async throws -> UUID {
        guard let apiKey = AppConfig.apiKey else { throw ServerError(status: 401) }
        var request = URLRequest(url: URL(string: "https://api.petify.petnow.io/v2/capture-sessions")!)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-petnow-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "species": "DOG",
            "purpose": "PET_IDENTIFICATION",
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 201 else { throw ServerError(status: status) }

        struct Envelope: Decodable {
            struct Session: Decodable { let id: UUID }
            let data: Session
        }
        return try JSONDecoder().decode(Envelope.self, from: data).data.id
    }
}
