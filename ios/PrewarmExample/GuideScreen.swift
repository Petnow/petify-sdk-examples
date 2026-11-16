import SwiftUI
import PetnowUI

/// The screen before the camera: the user reads it for a few seconds, which is
/// exactly the time prewarm needs.
struct GuideScreen: View {
    let purpose: Purpose
    let onStartCamera: (CaptureSession) -> Void
    @State private var session: Result<CaptureSession, Error>?
    /// "Try again" bumps this, which runs the `.task(id:)` below once more.
    @State private var attempt = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if case .verify(let petId) = purpose {
                Text("Pet \(petId.prefix(8))…").font(.subheadline).foregroundStyle(Theme.inkMuted)
            }
            Text("Before you start").font(.title2.bold()).foregroundStyle(Theme.ink)
            Group {
                Label("Get close enough that the nose fills the frame.", systemImage: "viewfinder")
                Label("Use soft, even light and avoid glare on the nose.", systemImage: "sun.max")
                Label("Hold still until the progress is complete.", systemImage: "hand.raised")
            }
            .foregroundStyle(Theme.ink)
            .labelStyle(TipLabelStyle())
            Spacer()
            startButton
        }
        .padding(24)
        .background(Theme.appBg)
        .navigationTitle(purpose.title)
        .onAppear {
            guard let license = AppConfig.license else { return }
            // ① Prewarm here, on the screen whose button leads to the camera.
            //    It validates the licence and loads the models now, so the camera
            //    screen only has to open the camera. Fire and forget: it never throws,
            //    and a camera start that arrives while it is still running joins it.
            //    No species — an engine prepared without one serves whichever camera opens.
            //    A plain Task, not .task: SwiftUI cancels .task when this screen disappears,
            //    which happens on the way into the camera, while the prewarm must carry on.
            Task { await CameraController.prewarm(licenseInfo: license) }
        }
        .task(id: attempt) {
            // Camera-only mode asks Petify for one itself; server mode asks the example server.
            // Coming back to this screen asks for a new one — fine for a demo.
            session = nil
            do { session = .success(try await CaptureSession.create(for: purpose)) }
            catch {
                guard !Task.isCancelled else { return }   // the screen left; nothing to report
                session = .failure(error)
            }
        }
    }

    @ViewBuilder private var startButton: some View {
        switch session {
        case .success(let session):
            Button("Open camera") { onStartCamera(session) }
                .buttonStyle(PrimaryButtonStyle())
        case .failure(let error):
            VStack(spacing: 12) {
                Text("Could not create a capture session: \(error.localizedDescription)")
                    .font(.footnote)
                    .foregroundStyle(Theme.error)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button("Try again") { attempt += 1 }
                    .buttonStyle(SecondaryButtonStyle())
            }
        case nil:
            ProgressView("Creating a capture session…")
                .frame(maxWidth: .infinity)
        }
    }
}

/// The icon in the main colour, the text in ink.
private struct TipLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            configuration.icon.foregroundStyle(Theme.main).frame(width: 28)
            configuration.title
        }
    }
}
