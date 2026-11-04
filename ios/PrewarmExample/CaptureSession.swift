import Foundation
import PetnowUI

/// What the user picked on Home. The raw value is the example server's `purpose`.
enum Purpose: String, Hashable {
    case identify, register

    var detection: DetectionPurpose {
        self == .register ? .petProfileRegistration : .petIdentification
    }
}

/// The capture session the camera writes into, and what it is for.
struct CaptureSession: Hashable {
    let id: UUID
    let purpose: Purpose

    /// Camera-only mode: the app creates an identification session itself.
    /// Server mode: the example server creates it (for a registration, after the pet).
    static func create(for purpose: Purpose) async throws -> CaptureSession {
        let id: UUID
        if AppConfig.isServerMode {
            id = try await ExampleServer.createSession(for: purpose)
        } else {
            precondition(purpose == .identify, "Home offers registration only in server mode")
            id = try await DemoCaptureSessions.create()
        }
        return CaptureSession(id: id, purpose: purpose)
    }
}
