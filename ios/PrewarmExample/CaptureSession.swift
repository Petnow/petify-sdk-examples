import Foundation
import PetnowUI

/// What the user picked on Home.
enum Purpose: Hashable {
    case identify, register
    /// 1:1 against a pet this example registered (server mode only).
    case verify(petId: String)

    /// The example server's `purpose`, and the name of its job route.
    var name: String {
        switch self {
        case .identify: return "identify"
        case .register: return "register"
        case .verify: return "verify"
        }
    }

    var title: String {
        switch self {
        case .identify: return "Identify a pet"
        case .register: return "Register a pet"
        case .verify: return "Verify a pet"
        }
    }

    var detection: DetectionPurpose {
        switch self {
        case .identify: return .petIdentification
        case .register: return .petProfileRegistration
        case .verify: return .petVerification
        }
    }
}

/// The capture session the camera writes into, and what it is for.
struct CaptureSession: Hashable {
    let id: UUID
    let purpose: Purpose

    /// Camera-only mode: the app creates an identification session itself.
    /// Server mode: the example server creates it (for a registration, after the pet;
    /// for a verification, for the chosen pet).
    static func create(for purpose: Purpose) async throws -> CaptureSession {
        let id: UUID
        if AppConfig.isServerMode {
            id = try await ExampleServer.createSession(for: purpose)
        } else {
            precondition(purpose == .identify, "Home offers register and verify only in server mode")
            id = try await DemoCaptureSessions.create()
        }
        return CaptureSession(id: id, purpose: purpose)
    }
}
