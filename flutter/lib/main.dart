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

void main() =>
    runApp(ExampleApp(api: ExampleApi(const AppConfig.fromEnvironment())));

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key, required this.api});

  final ExampleApi api;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Petify SDK example',
        theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
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

  bool get _hasKey => widget.api.config.apiKey.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _camera.addListener(_rebuild);
    // Registers the licence with the native SDK; nothing is loaded yet.
    if (_hasKey) _camera.initialize();
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    _camera.removeListener(_rebuild);
    _camera.dispose();
    super.dispose();
  }

  Future<void> _start(DetectionPurpose purpose) async {
    final flow = CaptureFlow(widget.api, purpose);
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => GuideScreen(camera: _camera, flow: flow),
      ),
    );
    // Back on Home: Back from the guide, or Done on the result.
    flow.close();
    // ④ Release what prewarm prepared only now that the user has left the
    //    capture flow. Not in the guide's dispose: that also runs on the way
    //    *into* the camera, and would destroy the engine the camera is about
    //    to take. It waits for a camera view that is still closing. Optional —
    //    the SDK also lets go under memory pressure.
    await _camera.releasePrewarmed();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = _camera.state;
    final ready = _hasKey && state is CameraReady;
    final serverMode = widget.api.serverMode;
    final error = TextStyle(color: theme.colorScheme.error);

    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Icon(Icons.pets, size: 72, color: theme.colorScheme.primary),
              const SizedBox(height: 16),
              Text(
                'Petify SDK example',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'Home → capture guide (prewarm) → camera → result. '
                'Nothing is prepared until you start.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                serverMode
                    ? 'Server mode: ${widget.api.config.serverUrl}'
                    : 'Camera-only mode',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall,
              ),
              const Spacer(),
              if (widget.api.config.serverHalfSet)
                Text(
                  'Server mode needs both EXAMPLE_SERVER_URL and '
                  'EXAMPLE_SERVER_TOKEN in .env.',
                  textAlign: TextAlign.center,
                  style: error,
                ),
              if (!_hasKey)
                Text(
                  'Set PETIFY_API_KEY in .env, then run with '
                  '--dart-define-from-file=.env.',
                  textAlign: TextAlign.center,
                  style: error,
                ),
              if (state is CameraError) ...[
                Text(state.error, textAlign: TextAlign.center, style: error),
                TextButton(
                  onPressed: _camera.initialize,
                  child: const Text('Retry'),
                ),
              ],
              const SizedBox(height: 12),
              FilledButton(
                onPressed: ready
                    ? () => _start(DetectionPurpose.identification)
                    : null,
                child: const Text('Identify a pet'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: ready && serverMode
                    ? () => _start(DetectionPurpose.registration)
                    : null,
                child: const Text('Register a pet'),
              ),
              if (!serverMode)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Needs the example server (see server/README)',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
