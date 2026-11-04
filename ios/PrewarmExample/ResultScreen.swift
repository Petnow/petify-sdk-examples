import SwiftUI

struct CaptureSummary: Hashable {
    let fingerprintImages: [URL]
    let appearanceImageCount: Int
    let engineReused: Bool
    let firstFrameMs: Int?
}

struct ResultScreen: View {
    let summary: CaptureSummary
    let onDone: () -> Void
    // Decoded once when the screen appears, not on every render of body.
    @State private var preview: UIImage?

    var body: some View {
        List {
            Section("Captured") {
                LabeledContent("Nose images", value: "\(summary.fingerprintImages.count)")
                LabeledContent("Appearance images", value: "\(summary.appearanceImageCount)")
            }
            Section {
                LabeledContent("Engine ready at camera start", value: summary.engineReused ? "Yes" : "No")
                if let ms = summary.firstFrameMs {
                    LabeledContent("First processed frame", value: "\(ms) ms")
                }
            } header: {
                Text("Camera start")
            } footer: {
                Text("Upload the images to your server, which sends them to Petify with the capture session ID.")
            }
            if let preview {
                Image(uiImage: preview)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 200)
            }
        }
        .navigationTitle("Result")
        .task { preview = summary.fingerprintImages.first.flatMap { UIImage(contentsOfFile: $0.path) } }
        .navigationBarBackButtonHidden()
        .toolbar { Button("Done", action: onDone) }
    }
}
