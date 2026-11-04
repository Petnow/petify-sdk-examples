import SwiftUI
import PetnowUI

@main
struct PrewarmExampleApp: App {
    var body: some Scene {
        WindowGroup { RootView() }
    }
}

enum Route: Hashable {
    case guide(Purpose)
    case camera(CaptureSession)
    case result(CaptureSession, CaptureSummary)
}

struct RootView: View {
    @State private var path: [Route] = []

    var body: some View {
        NavigationStack(path: $path) {
            HomeScreen { path.append(.guide($0)) }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .guide(let purpose):
                        GuideScreen(purpose: purpose) { path.append(.camera($0)) }
                    case .camera(let session):
                        CameraScreen(session: session) { path.append(.result(session, $0)) }
                    case .result(let session, let summary):
                        ResultScreen(session: session, summary: summary) { path.removeAll() }
                    }
                }
        }
        // ④ Release what prewarm prepared only when the user leaves the capture flow.
        //    Not in GuideScreen.onDisappear: that also fires on the way *into* the camera,
        //    and releasing there destroys the engine the camera is about to take.
        //    Releasing is optional — the SDK also lets go under memory pressure.
        .onChange(of: path.isEmpty) { backHome in
            guard backHome else { return }
            CameraController.releasePrewarmed()
            // Server mode: back home from a registration that did not register (Back,
            // Close, Done before Send, or a failed register) — delete the pet the server
            // created for it.
            ExampleServer.abandonOpenRegistrations()
        }
    }
}
