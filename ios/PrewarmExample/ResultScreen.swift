import SwiftUI

struct CaptureSummary: Hashable {
    let fingerprintImages: [URL]
    let appearanceImages: [URL]
    let engineReused: Bool
    let firstFrameMs: Int?
}

struct ResultScreen: View {
    let session: CaptureSession
    let summary: CaptureSummary
    let onDone: () -> Void
    // Decoded once when the screen appears, not on every render of body.
    @State private var preview: UIImage?
    @State private var sending = false
    @State private var progress = ""
    @State private var outcome: Result<ExampleServer.Outcome, Error>?

    var body: some View {
        List {
            Section("Captured") {
                LabeledContent("Nose images", value: "\(summary.fingerprintImages.count)")
                LabeledContent("Appearance images", value: "\(summary.appearanceImages.count)")
            }
            Section("Camera start") {
                LabeledContent("Engine ready at camera start", value: summary.engineReused ? "Yes" : "No")
                if let ms = summary.firstFrameMs {
                    LabeledContent("First processed frame", value: "\(ms) ms")
                }
            }
            if AppConfig.isServerMode {
                serverSection
            } else {
                Text("Run the example server to register or identify these images (server/README)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
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
        // Leaving a registration without a successful register deletes its pet (RootView).
        .toolbar { Button("Done", action: onDone).disabled(sending) }
    }

    @ViewBuilder private var serverSection: some View {
        Section(session.purpose == .register ? "Register" : "Identify") {
            switch outcome {
            case nil:
                Button(sending ? progress : "Send") { Task { await send() } }
                    .disabled(sending)
            case .success(.registered(let status, let petId)):
                LabeledContent("Status", value: status)
                if let petId { LabeledContent("Pet ID", value: petId) }
            case .success(.identified(let status, let candidates)):
                LabeledContent("Status", value: status)
                if candidates.isEmpty { Text("No matching pet") }
                ForEach(candidates.prefix(3), id: \.petId) {
                    Text("\($0.petId) · \($0.score)\($0.isMatch == true ? "  ✓ match" : "")")
                }
            case .failure(let error):
                Text(error.localizedDescription).foregroundStyle(.red)
            }
        }
    }

    /// Uploads every image to the capture session, then registers or identifies. One try:
    /// after an outcome or an error, Done returns home and a new capture starts over.
    private func send() async {
        sending = true
        defer { sending = false }
        do {
            let uploads = summary.fingerprintImages.map { ($0, "fingerprints") }
                + summary.appearanceImages.map { ($0, "appearances") }
            for (index, (file, kind)) in uploads.enumerated() {
                progress = "Uploading \(index + 1) of \(uploads.count)…"
                try await ExampleServer.upload(file, kind: kind, session: session.id)
            }
            progress = session.purpose == .register ? "Registering…" : "Identifying…"
            outcome = .success(try await ExampleServer.finish(session))
        } catch {
            outcome = .failure(error)
        }
    }
}
