import SwiftUI

struct HomeScreen: View {
    let onStart: (Purpose) -> Void
    /// Server mode: the pets this example registered. Loaded each time Home appears.
    @State private var pets: Result<[ExampleServer.Pet], Error>?

    private var hasKey: Bool { AppConfig.apiKey != nil }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                notices
                scanCard
                petsCard
                tipsCard
                // The host is not a secret; the token is never shown.
                Text(AppConfig.serverURL.map { "Server mode: \($0.absoluteString)" } ?? "Camera-only mode")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkMuted)
                    .padding(.top, 4)
            }
            .padding(16)
        }
        .background(Theme.appBg)
        .safeAreaInset(edge: .top, spacing: 0) { topBar }
        .toolbar(.hidden, for: .navigationBar)
        .navigationTitle("Home")
        .task { await loadPets() }
        .refreshable { await loadPets() }
    }

    private var topBar: some View {
        Text("Petify")
            .font(.system(size: 28, weight: .bold))
            .foregroundStyle(Theme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Theme.surface.ignoresSafeArea(edges: .top))
    }

    @ViewBuilder private var notices: some View {
        if !hasKey {
            notice("Set PETNOW_API_KEY in ios/Config/Secrets.xcconfig, then rebuild.", systemImage: "key")
        }
        if AppConfig.serverConfigIncomplete {
            notice("Set both EXAMPLE_SERVER_HOST (host:port, no http://) and EXAMPLE_SERVER_TOKEN, then rebuild.",
                   systemImage: "exclamationmark.circle")
        }
    }

    private func notice(_ text: String, systemImage: String) -> some View {
        Label(text, systemImage: systemImage)
            .font(.footnote)
            .foregroundStyle(Theme.error)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private var scanCard: some View {
        Card(title: "Biometric scan", systemImage: "pawprint.fill") {
            HStack(spacing: 12) {
                ActionCard(title: "Identify\na pet", systemImage: "qrcode.viewfinder") { onStart(.identify) }
                    .disabled(!hasKey)
                // Registering creates a pet, which needs the Secret key: only the example server has it.
                ActionCard(title: "Register\na pet", systemImage: "camera") { onStart(.register) }
                    .disabled(!hasKey || !AppConfig.isServerMode)
            }
            if !AppConfig.isServerMode {
                Text("Needs the example server (see server/README)")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkMuted)
            }
        }
    }

    private var petsCard: some View {
        Card(title: "Pets", systemImage: "pawprint.fill") {
            if !AppConfig.isServerMode {
                // Listing pets needs the Secret key, so verifying needs the example server too.
                Text("Run the example server (server/README) to register and verify pets.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkMuted)
            } else {
                switch pets {
                case nil:
                    ProgressView().frame(maxWidth: .infinity)
                case .failure(let error):
                    Text(error.localizedDescription)
                        .font(.subheadline)
                        .foregroundStyle(Theme.error)
                    Button("Retry") { Task { await loadPets() } }
                        .foregroundStyle(Theme.main)
                case .success(let list) where list.isEmpty:
                    Text("No pets yet. Register a pet first.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkMuted)
                case .success(let list):
                    VStack(spacing: 0) {
                        ForEach(Array(list.enumerated()), id: \.element.petId) { index, pet in
                            if index > 0 { Theme.hairline.frame(height: 1).padding(.horizontal, -16) }
                            PetRow(pet: pet) { onStart(.verify(petId: pet.petId)) }
                                .disabled(!hasKey)
                        }
                    }
                }
            }
        }
    }

    private var tipsCard: some View {
        Card(title: "Before you scan", systemImage: "info.circle") {
            Tip(systemImage: "sun.max", title: "Shoot in a bright place.",
                detail: "An environment where the pet's nose and face are clearly visible works best.")
            Tip(systemImage: "viewfinder", title: "Follow the guide.",
                detail: "Fit the dog's nose inside the on-screen guide.")
            Tip(systemImage: "speaker.wave.2", title: "Use sounds to draw attention.",
                detail: "Sounds can help get your pet to look at the camera.")
        }
    }

    private func loadPets() async {
        guard AppConfig.isServerMode else { return }
        do { pets = .success(try await ExampleServer.listPets()) }
        catch {
            guard !Task.isCancelled else { return }   // Home left; the next visit loads again
            pets = .failure(error)
        }
    }
}

/// One of the two big buttons on Home: a two-line title and a large faded icon.
private struct ActionCard: View {
    let title: String
    let systemImage: String
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topLeading) {
                Theme.actionCard
                Image(systemName: systemImage)
                    .font(.system(size: 72))
                    .foregroundStyle(.white.opacity(0.3))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .offset(x: 10, y: 10)
                Text(title)
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .padding(16)
            }
            .frame(height: 176)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(PressDimStyle())   // .plain dims a disabled button again on top of this
        .opacity(isEnabled ? 1 : 0.4)
    }
}

private struct PressDimStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.85 : 1)
    }
}

private struct PetRow: View {
    let pet: ExampleServer.Pet
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: "pawprint.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.brand)
                    .frame(width: 48, height: 48)
                    .background(Theme.surfaceTint, in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(pet.petId.prefix(8))…").font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                    Text("Tap to verify this pet").font(.subheadline).foregroundStyle(Theme.inkMuted)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.inkFaint)
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct Tip: View {
    let systemImage: String
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 24))
                .foregroundStyle(Theme.main)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                Text(detail).font(.subheadline).foregroundStyle(Theme.inkMuted)
            }
        }
    }
}
