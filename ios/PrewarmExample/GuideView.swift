import SwiftUI
import PetnowUI

/// The screen before the camera: the user reads it for a few seconds, which is
/// exactly the time prewarm needs.
struct GuideView: View {
    let onStartCamera: (UUID) -> Void
    @State private var session: Result<UUID, Error>?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Before you start").font(.title2.bold())
            Label("Get close enough that the nose fills the frame.", systemImage: "viewfinder")
            Label("Use soft, even light and avoid glare on the nose.", systemImage: "sun.max")
            Label("Hold still until the progress is complete.", systemImage: "hand.raised")
            Spacer()
            startButton
        }
        .padding(24)
        .navigationTitle("Capture guide")
        .onAppear {
            guard let license = AppConfig.license else { return }
            // ① Prewarm here, on the screen whose button leads to the camera.
            //    It validates the licence and loads the models now, so the camera
            //    screen only has to open the camera. Fire and forget: it never throws,
            //    and a camera start that arrives while it is still running joins it.
            //    No species — an engine prepared without one serves whichever camera opens.
            Task { await CameraController.prewarm(licenseInfo: license) }
        }
        .task {
            // Your server issues the capture session; this example asks for one itself.
            do { session = .success(try await DemoCaptureSessions.create()) }
            catch { session = .failure(error) }
        }
    }

    @ViewBuilder private var startButton: some View {
        switch session {
        case .success(let id):
            Button("Open camera") { onStartCamera(id) }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
        case .failure(let error):
            Text("Could not create a capture session: \(error.localizedDescription)")
                .font(.footnote)
                .foregroundStyle(.red)
        case nil:
            ProgressView("Creating a capture session…")
                .frame(maxWidth: .infinity)
        }
    }
}
