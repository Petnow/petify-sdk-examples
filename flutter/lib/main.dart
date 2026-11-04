// Petify SDK example: Home → Capture guide → Camera → Result.
//
//   cp .env.example .env    # PETIFY_API_KEY = a Client key (app)
//   flutter run --release --dart-define-from-file=.env
//
// The numbered comments ①–⑤ mark the same steps as the iOS, Android and React
// Native examples. lib/quickstart.dart is the bare SDK integration in one file.

import 'package:flutter/material.dart';
import 'package:petnow_camera_ui/petnow_camera_ui.dart';

import 'example_api.dart';
import 'guide_screen.dart';
import 'petify_theme.dart';

void main() =>
    runApp(ExampleApp(api: ExampleApi(const AppConfig.fromEnvironment())));

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key, required this.api});

  final ExampleApi api;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Petify SDK example',
        theme: petifyTheme(),
        home: HomeScreen(api: api),
      );
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api});

  final ExampleApi api;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // One controller for the app. It holds the licence; the guide's prewarm, the
  // camera and the release below all go through it.
  late final PetnowCameraController _camera = PetnowCameraController(
    license: LicenseInfo(apiKey: widget.api.config.apiKey),
  );

  /// Server mode: the pets to verify, reloaded whenever the user is back home.
  Future<List<String>>? _pets;

  bool get _hasKey => widget.api.config.apiKey.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _camera.addListener(_rebuild);
    // Registers the licence with the native SDK; nothing is loaded yet.
    if (_hasKey) _camera.initialize();
    _loadPets();
  }

  void _rebuild() => setState(() {});

  void _loadPets() {
    if (!widget.api.serverMode) return;
    setState(() {
      _pets = widget.api.listPets();
    });
  }

  @override
  void dispose() {
    _camera.removeListener(_rebuild);
    _camera.dispose();
    super.dispose();
  }

  Future<void> _start(DetectionPurpose purpose, {String? petId}) async {
    final flow = CaptureFlow(widget.api, purpose, petId: petId);
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => GuideScreen(camera: _camera, flow: flow),
      ),
    );
    // Back on Home: Back from the guide, or Done on the result.
    flow.close();
    if (mounted) _loadPets(); // a registration may have added one
    // ④ Release what prewarm prepared only now that the user has left the
    //    capture flow. Not in the guide's dispose: that also runs on the way
    //    *into* the camera, and would destroy the engine the camera is about
    //    to take. It waits for a camera view that is still closing. Optional —
    //    the SDK also lets go under memory pressure.
    await _camera.releasePrewarmed();
  }

  @override
  Widget build(BuildContext context) {
    final state = _camera.state;
    final ready = _hasKey && state is CameraReady;
    final serverMode = widget.api.serverMode;

    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        title: const Text(
          'Petify',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.api.config.serverHalfSet)
              const _Notice(
                Icons.error_outline,
                'Server mode needs both EXAMPLE_SERVER_URL and '
                'EXAMPLE_SERVER_TOKEN in .env.',
              ),
            if (!_hasKey)
              const _Notice(
                Icons.key_off_outlined,
                'Set PETIFY_API_KEY in .env, then run with '
                '--dart-define-from-file=.env.',
              ),
            if (state is CameraError)
              _Notice(
                Icons.error_outline,
                state.error,
                action: TextButton(
                  onPressed: _camera.initialize,
                  child: const Text('Retry'),
                ),
              ),
            _Section(
              icon: Icons.pets,
              title: 'Biometric scan',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _ActionCard(
                          title: 'Identify\na pet',
                          icon: Icons.qr_code_scanner,
                          onTap: ready
                              ? () => _start(DetectionPurpose.identification)
                              : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ActionCard(
                          title: 'Register\na pet',
                          icon: Icons.photo_camera_outlined,
                          onTap: ready && serverMode
                              ? () => _start(DetectionPurpose.registration)
                              : null,
                        ),
                      ),
                    ],
                  ),
                  if (!serverMode)
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'Needs the example server (see server/README)',
                        style: TextStyle(color: Petify.inkMuted),
                      ),
                    ),
                ],
              ),
            ),
            _Section(
              icon: Icons.pets,
              title: 'Pets',
              child: serverMode
                  ? _PetList(
                      pets: _pets,
                      onRetry: _loadPets,
                      onVerify: ready
                          ? (petId) => _start(DetectionPurpose.verification,
                              petId: petId)
                          : null,
                    )
                  : const Text(
                      'Run the example server (server/README) to register '
                      'and verify pets.',
                      style: TextStyle(color: Petify.inkMuted),
                    ),
            ),
            const _Section(
              icon: Icons.info_outline,
              title: 'Before you scan',
              child: Column(
                children: [
                  _Tip(
                    Icons.wb_sunny_outlined,
                    'Shoot in a bright place.',
                    "An environment where the pet's nose and face are "
                        'clearly visible works best.',
                  ),
                  _Tip(
                    Icons.center_focus_strong_outlined,
                    'Follow the guide.',
                    "Fit the dog's nose inside the on-screen guide.",
                  ),
                  _Tip(
                    Icons.volume_up_outlined,
                    'Use sounds to draw attention.',
                    'Sounds can help get your pet to look at the camera.',
                  ),
                ],
              ),
            ),
            Text(
              serverMode
                  ? 'Server mode: ${widget.api.config.serverUrl}'
                  : 'Camera-only mode',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Petify.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// A white card with an icon and a title, as on the Petify app's home.
class _Section extends StatelessWidget {
  const _Section(
      {required this.icon, required this.title, required this.child});

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Petify.surface,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(icon, color: Petify.main),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Petify.ink,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      );
}

/// A big blue card that starts a capture; dimmed while it cannot.
class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.title, required this.icon, this.onTap});

  final String title;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Opacity(
        opacity: onTap == null ? 0.4 : 1,
        child: Material(
          color: Petify.actionCard,
          borderRadius: BorderRadius.circular(12),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              height: 176,
              child: Stack(
                children: [
                  Positioned(
                    left: 16,
                    top: 16,
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Positioned(
                    right: -8,
                    bottom: -8,
                    child: Icon(
                      icon,
                      size: 80,
                      color: Colors.white.withValues(alpha: 0.3),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}

/// Server mode: the registered pets; tap one to verify it.
class _PetList extends StatelessWidget {
  const _PetList({required this.pets, required this.onRetry, this.onVerify});

  final Future<List<String>>? pets;
  final VoidCallback onRetry;
  final void Function(String petId)? onVerify;

  @override
  Widget build(BuildContext context) => FutureBuilder<List<String>>(
        future: pets,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Row(
              children: [
                Expanded(
                  child: Text(
                    '${snapshot.error}',
                    style: const TextStyle(color: Petify.error),
                  ),
                ),
                TextButton(onPressed: onRetry, child: const Text('Retry')),
              ],
            );
          }
          final ids = snapshot.data;
          if (ids == null) {
            return const Center(
              child: SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          }
          if (ids.isEmpty) {
            return const Text(
              'No pets yet. Register a pet first.',
              style: TextStyle(color: Petify.inkMuted),
            );
          }
          return Column(
            children: [
              for (final (index, petId) in ids.indexed) ...[
                if (index > 0) const Divider(height: 1, color: Petify.hairline),
                _PetRow(
                  petId: petId,
                  onTap: onVerify == null ? null : () => onVerify!(petId),
                ),
              ],
            ],
          );
        },
      );
}

class _PetRow extends StatelessWidget {
  const _PetRow({required this.petId, this.onTap});

  final String petId;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Petify.surfaceTint,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.pets, color: Petify.brand),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      shortPetId(petId),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: Petify.ink,
                      ),
                    ),
                    const Text(
                      'Tap to verify this pet',
                      style: TextStyle(color: Petify.inkMuted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Petify.inkFaint),
            ],
          ),
        ),
      );
}

class _Tip extends StatelessWidget {
  const _Tip(this.icon, this.title, this.body);

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 28, color: Petify.main),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Petify.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(body, style: const TextStyle(color: Petify.inkMuted)),
                ],
              ),
            ),
          ],
        ),
      );
}

/// A line above the cards when something stops the app from scanning.
class _Notice extends StatelessWidget {
  const _Notice(this.icon, this.text, {this.action});

  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Icon(icon, color: Petify.error),
            const SizedBox(width: 8),
            Expanded(
              child: Text(text, style: const TextStyle(color: Petify.error)),
            ),
            if (action != null) action!,
          ],
        ),
      );
}
