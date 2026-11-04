import SwiftUI
import PetnowUI

struct CameraScreen: View {
    @StateObject private var controller: CameraController
    @Environment(\.dismiss) private var dismiss
    @State private var showRetry = false
    @State private var startError: String?
    @State private var showStartError = false
    private let captureSessionId: UUID
    private let onCaptured: (CaptureSummary) -> Void

    init(captureSessionId: UUID, onCaptured: @escaping (CaptureSummary) -> Void) {
        self.captureSessionId = captureSessionId
        self.onCaptured = onCaptured
        _controller = StateObject(wrappedValue: CameraController(
            configuration: DetectionConfiguration(species: .dog, purpose: .petIdentification),
            licenseInfo: AppConfig.license!   // HomeScreen does not start the flow without a key
        ))
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            CameraView(controller: controller)   // hides the navigation bar
                .ignoresSafeArea()
            GuidanceBanner(text: guidance, progress: controller.currentDetectionProgress)
                .padding()
        }
        .overlay(alignment: .topLeading) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.headline)
                    .padding(12)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .padding()
            .accessibilityLabel("Close camera")
        }
        .task { await start() }
        .onDisappear { controller.finalizeCamera() }
        .alert("Capture failed", isPresented: $showRetry) {
            // ③ Retry with startDetection(): the camera stays open, so there is no second start.
            Button("Try again") { controller.startDetection() }
            Button("Leave", role: .cancel) { dismiss() }
        }
        .alert("Camera could not start", isPresented: $showStartError) {
            Button("OK") { dismiss() }
        } message: {
            Text(startError ?? "")
        }
    }

    private func start() async {
        do {
            try await controller.initializeCamera(initialPosition: .back,
                                                  captureSessionId: captureSessionId) { result in
                Task { @MainActor in finish(result) }
            }
            controller.startDetection()
        } catch {
            // An invalid key, a denied permission or no camera surfaces here —
            // never from prewarm.
            startError = error.localizedDescription
            showStartError = true
        }
    }

    private func finish(_ result: CameraResult) {
        switch result {
        case let .success(fingerprintImages, appearanceImages):
            let phases = controller.performanceStats.phases
            onCaptured(CaptureSummary(
                fingerprintImages: fingerprintImages,
                appearanceImageCount: appearanceImages.count,
                // ⑤ engineReused: the engine was already built when the camera started —
                //    true after a finished prewarm or when an earlier camera left one;
                //    false when this camera built it (on iOS, also when it joined a
                //    prewarm still building).
                engineReused: phases.engineReused ?? false,
                firstFrameMs: phases.firstFrameAtMs
            ))
        case .fail:
            showRetry = true
        @unknown default:
            showRetry = true
        }
    }

    // ② Guide from detection feedback, not from the preview appearing. Since 1.6.0 the
    //    preview is up before the models are ready; detectionReadyAtMs marks the moment
    //    detection begins. With a prewarm that is almost immediate.
    private var guidance: String {
        guard controller.performanceStats.phases.detectionReadyAtMs != nil else {
            return "Getting ready…"
        }
        switch controller.detectionStatus {
        case .noObject: return "Point the camera at your dog's nose"
        case .processing, .detected: return "Hold still…"
        case .finished: return "Done"
        case .failed(let reason): return Self.hint(for: reason)
        @unknown default: return "Hold still…"
        }
    }

    private static func hint(for reason: DetectionFailureReason) -> String {
        switch reason {
        case .tooClose: return "Move a little farther away"
        case .tooFarAway: return "Move a little closer"
        case .tooDark: return "Find a brighter spot"
        case .tooBright, .glareDetected: return "Avoid direct light on the nose"
        case .tooBlurred, .motionBlurDetected, .defocusedBlurDetected: return "Hold the phone still"
        case .shadowDetected: return "Avoid shadows on the nose"
        default: return "Point the camera straight at the nose"
        }
    }
}

private struct GuidanceBanner: View {
    let text: String
    let progress: Int

    var body: some View {
        VStack(spacing: 8) {
            Text(text).font(.headline)
            ProgressView(value: Double(progress), total: 100)
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}
