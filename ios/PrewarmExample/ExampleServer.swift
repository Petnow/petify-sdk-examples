import Foundation

/// Server mode: calls to the example server in ../server (see server/README.md).
///
/// The server holds the Secret key and calls the Petify Server API; the app holds only
/// a Client key and the server's token. In production your own backend plays this part.
enum ExampleServer {
    /// A server error, shown as "HTTP <status> <code>: <message>".
    struct Failure: LocalizedError {
        let status: Int
        let code: String
        let message: String
        var errorDescription: String? { "HTTP \(status) \(code): \(message)" }
    }

    enum Outcome {
        case registered(status: String, petId: String?)
        case identified(status: String, candidates: [Candidate])
    }

    struct Candidate: Decodable {
        let petId: String
        let score: Int        // 0–100
        let isMatch: Bool?    // Petify's verdict for this candidate
    }

    /// Registration sessions whose pet the server created and nothing has been
    /// registered to yet. `abandonOpenRegistrations()` deletes those pets.
    @MainActor private static var openRegistrations: Set<UUID> = []

    @MainActor
    static func createSession(for purpose: Purpose) async throws -> UUID {
        // A guide screen shown again asks for a new session; drop the one from before.
        abandonOpenRegistrations()
        var request = makeRequest("sessions", method: "POST", timeout: 15)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Dog only. For cats, send "CAT" here and use .cat in CameraScreen's DetectionConfiguration.
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "purpose": purpose.rawValue,
            "species": "DOG",
        ])
        // Not cancelled with the guide screen: for a registration the server may already
        // have created a pet, and its session ID must come back so the pet can be deleted.
        let finalRequest = request
        let data = try await Task { try await send(finalRequest) }.value
        struct Created: Decodable { let sessionId: UUID }
        let id = try JSONDecoder().decode(Created.self, from: data).sessionId
        if purpose == .register { openRegistrations.insert(id) }
        return id
    }

    /// Uploads one image (multipart field `file`) to /fingerprints or /appearances.
    static func upload(_ file: URL, kind: String, session: UUID) async throws {
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data("--\(boundary)\r\n".utf8)
        body.append(Data("Content-Disposition: form-data; name=\"file\"; filename=\"\(file.lastPathComponent)\"\r\n".utf8))
        body.append(Data("Content-Type: image/jpeg\r\n\r\n".utf8))
        body.append(try Data(contentsOf: file))
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        var request = makeRequest("sessions/\(path(session))/\(kind)", method: "POST", timeout: 60)
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        // httpBody is Data, so URLSession sends a Content-Length (Petify rejects some chunked uploads).
        _ = try await send(request)
    }

    /// POST /register or /identify. The server polls Petify's job for up to 30 s
    /// before it answers, so this waits longer than the 15 s of the other JSON calls.
    @MainActor
    static func finish(_ session: CaptureSession) async throws -> Outcome {
        let request = makeRequest("sessions/\(path(session.id))/\(session.purpose.rawValue)", method: "POST", timeout: 60)
        let data = try await send(request)
        switch session.purpose {
        case .register:
            struct Body: Decodable { let status: String; let petId: String? }
            let body = try JSONDecoder().decode(Body.self, from: data)
            if body.status == "SUCCESS" { openRegistrations.remove(session.id) }
            return .registered(status: body.status, petId: body.petId)
        case .identify:
            struct Body: Decodable { let status: String; let candidates: [Candidate]? }
            let body = try JSONDecoder().decode(Body.self, from: data)
            return .identified(status: body.status, candidates: body.candidates ?? [])
        }
    }

    /// The user left a registration without a successful register: DELETE each session
    /// so the server deletes the pet it created. Fire and forget.
    @MainActor
    static func abandonOpenRegistrations() {
        for id in openRegistrations {
            URLSession.shared.dataTask(with: makeRequest("sessions/\(path(id))", method: "DELETE", timeout: 15)).resume()
        }
        openRegistrations.removeAll()
    }

    // Session IDs come from Petify in lower case; UUID.uuidString is upper case.
    private static func path(_ id: UUID) -> String { id.uuidString.lowercased() }

    private static func makeRequest(_ path: String, method: String, timeout: TimeInterval) -> URLRequest {
        // Only called in server mode, where both values are set.
        var request = URLRequest(url: AppConfig.serverURL!.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = timeout
        request.setValue("Bearer \(AppConfig.serverToken!)", forHTTPHeaderField: "Authorization")
        return request
    }

    private static func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            struct Body: Decodable { let error: String?; let message: String? }
            let body = try? JSONDecoder().decode(Body.self, from: data)
            throw Failure(status: status,
                          code: body?.error ?? "error",
                          message: body?.message ?? HTTPURLResponse.localizedString(forStatusCode: status))
        }
        return data
    }
}
