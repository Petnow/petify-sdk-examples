import SwiftUI
import PetnowUI

@main
struct PrewarmExampleApp: App {
    var body: some Scene {
        WindowGroup { RootView() }
    }
}

enum Route: Hashable {
    case guide
    case camera(captureSessionId: UUID)
    case result(CaptureSummary)
}

struct RootView: View {
    @State private var path: [Route] = []

    var body: some View {
        NavigationStack(path: $path) {
            HomeScreen { path.append(.guide) }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .guide:
                        GuideScreen { path.append(.camera(captureSessionId: $0)) }
                    case .camera(let id):
                        CameraScreen(captureSessionId: id) { path.append(.result($0)) }
                    case .result(let summary):
                        ResultScreen(summary: summary) { path.removeAll() }
                    }
                }
        }
        // ④ Release what prewarm prepared only when the user leaves the capture flow.
        //    Not in GuideScreen.onDisappear: that also fires on the way *into* the camera,
        //    and releasing there destroys the engine the camera is about to take.
        //    Releasing is optional — the SDK also lets go under memory pressure.
        .onChange(of: path.isEmpty) { backHome in
            if backHome { CameraController.releasePrewarmed() }
        }
    }
}
