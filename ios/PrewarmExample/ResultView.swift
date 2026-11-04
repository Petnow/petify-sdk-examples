import SwiftUI

struct CaptureSummary: Hashable {
    let fingerprintImages: [URL]
    let appearanceImageCount: Int
    let engineReused: Bool
    let firstFrameMs: Int?
}

struct ResultView: View {
    let summary: CaptureSummary
    let onDone: () -> Void

    var body: some View {
        List {
            Section("Captured") {
                LabeledContent("Nose images", value: "\(summary.fingerprintImages.count)")
                LabeledContent("Appearance images", value: "\(summary.appearanceImageCount)")
            }
            Section {
                LabeledContent("Models were ready", value: summary.engineReused ? "Yes — prewarm took" : "No")
                if let ms = summary.firstFrameMs {
                    LabeledContent("First processed frame", value: "\(ms) ms")
                }
            } header: {
                Text("Camera start")
            } footer: {
                Text("Upload the images to your server, which sends them to Petify with the capture session ID.")
            }
            if let first = summary.fingerprintImages.first, let image = UIImage(contentsOfFile: first.path) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 200)
            }
        }
        .navigationTitle("Result")
        .navigationBarBackButtonHidden()
        .toolbar { Button("Done", action: onDone) }
    }
}
