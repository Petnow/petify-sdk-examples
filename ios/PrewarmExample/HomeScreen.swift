import SwiftUI

struct HomeScreen: View {
    let onStart: (Purpose) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "pawprint.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(.tint)
            Text("Petify SDK prewarm example")
                .font(.title2.bold())
            Text("Home → capture guide (prewarm) → camera → result. Nothing is prepared until you start.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            // The host is not a secret; the token is never shown.
            Text(AppConfig.serverURL.map { "Server mode: \($0.absoluteString)" } ?? "Camera-only mode")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Spacer()
            if AppConfig.apiKey == nil {
                Text("Set PETNOW_API_KEY in ios/Config/Secrets.xcconfig, then rebuild.")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
            if AppConfig.serverConfigIncomplete {
                Text("Set both EXAMPLE_SERVER_HOST (host:port, no http://) and EXAMPLE_SERVER_TOKEN, then rebuild.")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
            Button("Identify a pet") { onStart(.identify) }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(AppConfig.apiKey == nil)
            // Registering creates a pet, which needs the Secret key: only the example server has it.
            Button("Register a pet") { onStart(.register) }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(AppConfig.apiKey == nil || !AppConfig.isServerMode)
            if !AppConfig.isServerMode {
                Text("Needs the example server (see server/README)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(24)
        .navigationTitle("Home")
    }
}
