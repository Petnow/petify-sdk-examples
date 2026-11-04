import SwiftUI

struct HomeView: View {
    let onStart: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "pawprint.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(.tint)
            Text("Petnow SDK prewarm example")
                .font(.title2.bold())
            Text("Home → capture guide (prewarm) → camera → result. Nothing is prepared until you start.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Spacer()
            if AppConfig.apiKey == nil {
                Text("Set PETNOW_API_KEY in ios/Config/Secrets.xcconfig, then rebuild.")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
            Button("Scan a nose print", action: onStart)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(AppConfig.apiKey == nil)
        }
        .padding(24)
        .navigationTitle("Home")
    }
}
