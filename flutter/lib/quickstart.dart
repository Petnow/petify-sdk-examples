// Quickstart — the smallest complete integration of `petnow_camera_ui`.
//
//   flutter run -t lib/quickstart.dart --dart-define-from-file=.env
//
// Everything the SDK needs is in this one file, in the order you would add it
// to your own app. The full example next to it (`lib/main.dart`) adds the
// capture guide, the result screen and the optional example server on top of
// exactly this.
//
// What this file does NOT do, on purpose:
//   - style the capture screen (see the full example)
//   - talk to a server (see the note on the capture session id below)
//
// The key is the SDK's licence: a **Client key (app)** from the Petify Console.
// Never put a Secret key (server) in an app.

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:petnow_camera_ui/petnow_camera_ui.dart';

import 'petnow_guidance.dart';

const String kApiKey = String.fromEnvironment('PETIFY_API_KEY');

void main() => runApp(const QuickstartApp());

class QuickstartApp extends StatelessWidget {
  const QuickstartApp({super.key});

  @override
  Widget build(BuildContext context) => const MaterialApp(
        title: 'Petify SDK quickstart',
        home: HomePage(),
      );
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  // 1. One controller per app. It holds the license and the native camera
  //    session, so keep it alive across captures and dispose it with the state
  //    that owns it.
  late final PetnowCameraController _camera;

  @override
  void initState() {
    super.initState();
    _camera = PetnowCameraController(
      license: const LicenseInfo(apiKey: kApiKey),
    );
    _camera.addListener(() => setState(() {}));
    // 2. initialize() registers the license with the native SDK. Wait for
    //    `CameraReady` before mounting the camera view.
    //
    //    Then prewarm (SDK 1.6.0+): this screen is the one before the camera,
    //    so the licence check and the model load happen while the user is
    //    still here, and the camera opens on a ready engine. Not awaited; it
    //    never throws.
    _camera.initialize().then((_) => _camera.prewarm());
  }

  @override
  void dispose() {
    _camera.dispose();
    super.dispose();
  }

  Future<void> _capture() async {
    // 3. Ask for the camera permission before opening the camera. Android
    //    requires it; on iOS the SDK would prompt on its own, but asking here
    //    lets you explain why first.
    final permission = await Permission.camera.request();
    if (!permission.isGranted) {
      if (!mounted) return;
      // Permanently denied means the OS will not ask again — send the user to
      // Settings instead of silently failing.
      const action = SnackBarAction(
        label: 'Settings',
        onPressed: openAppSettings,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Camera permission is required.'),
          action: permission.isPermanentlyDenied ? action : null,
        ),
      );
      return;
    }
    if (!mounted || _camera.state is! CameraReady) return;

    // 4. The capture session id must be a UUID issued by your backend
    //    (`POST /v2/capture-sessions`); the server ties the uploaded images to
    //    it. A registration session must be scoped to a pet your backend
    //    created first, or the server answers PETNOWB2B20011. This placeholder
    //    lets the camera run; the server would reject an upload to it.
    const sessionId = '00000000-0000-4000-8000-000000000000';

    final result = await Navigator.of(context).push<CameraResult>(
      MaterialPageRoute(
        builder: (_) => CapturePage(
          controller: _camera,
          config: const PetnowCameraConfig(
            species: Species.dog,
            purpose: DetectionPurpose.identification,
            captureSessionId: sessionId,
          ),
        ),
      ),
    );

    if (!mounted || result == null) return;
    if (!result.success) {
      // Since 1.6.0 a failed capture says why on the result itself.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text('Capture failed: ${failureMessage(result.failureReason)}'),
        ),
      );
      return;
    }
    // 5. The result holds local file paths: `fingerprintImages` are the nose
    //    prints, `appearanceImages` the matching face frames. They live in the
    //    app's cache directory, so upload them (through your backend) before
    //    the OS reclaims the space.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${result.fingerprintImages.length} nose / '
          '${result.appearanceImages.length} face images',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = _camera.state;
    return Scaffold(
      appBar: AppBar(title: const Text('Petify SDK quickstart')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('SDK state: ${state.runtimeType}'),
            if (state is CameraError)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Text(
                      state.error,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red),
                    ),
                    const SizedBox(height: 8),
                    // Initialising can fail for a bad key or no network; let
                    // the user retry instead of dead-ending.
                    OutlinedButton(
                      onPressed: _camera.initialize,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            if (kApiKey.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Put PETIFY_API_KEY in .env (see .env.example)'),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: state is CameraReady ? _capture : null,
              child: const Text('Capture'),
            ),
          ],
        ),
      ),
    );
  }
}

/// The capture screen: the SDK's camera view plus whatever guidance you draw
/// on top of it.
class CapturePage extends StatefulWidget {
  const CapturePage({
    super.key,
    required this.controller,
    required this.config,
  });

  final PetnowCameraController controller;
  final PetnowCameraConfig config;

  @override
  State<CapturePage> createState() => _CapturePageState();
}

class _CapturePageState extends State<CapturePage> with WidgetsBindingObserver {
  DetectionStatus? _status;
  int _progress = 0;

  /// Set from [PetnowCameraView.onError]: the capture cannot run at all. Unlike
  /// detection guidance, there is nothing for the user to correct here, so the
  /// screen stops pretending to work.
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Guidance sounds need their samples loaded once before the first play.
    PetnowSound.prepare();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    PetnowSound.release();
    super.dispose();
  }

  // 6. Stop detecting while the app is in the background, and pick up again
  //    when it returns — otherwise the camera keeps running off-screen.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        widget.controller.resumeDetection();
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        widget.controller.pauseDetection();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 7. The camera view renders the native preview and the SDK's own
          //    tracking marker. Mount it only once the controller is ready.
          PetnowCameraView(
            controller: widget.controller,
            config: widget.config,
            onDetectionProgress: (p) => setState(() => _progress = p),
            onDetectionStatus: (s) => setState(() => _status = s),
            onDetectionFinished: (result) => Navigator.of(context).pop(result),
            // A refused key, no permission, a camera that would not open.
            // Branch on error.code; error.message is for logs.
            onError: (error) => setState(() => _error = error.message),
          ),

          // 8. Guidance is yours to draw. `guidanceFor` maps every SDK state —
          //    including the 21 failure reasons — to one line of copy.
          SafeArea(
            child: Column(
              children: [
                const Spacer(),
                Container(
                  width: double.infinity,
                  color: Colors.black54,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      if (_error != null) ...[
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.orangeAccent),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Close'),
                        ),
                      ] else ...[
                        Text(
                          guidanceFor(
                            _status,
                            isCat: widget.config.species == Species.cat,
                          ),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ],
                      if (_error == null && _progress > 0) ...[
                        const SizedBox(height: 8),
                        LinearProgressIndicator(value: _progress / 100),
                      ],
                      if (_error == null) ...[
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            TextButton(
                              onPressed: widget.controller.startDetection,
                              child: const Text('Retake'),
                            ),
                            TextButton(
                              onPressed: widget.controller.switchCamera,
                              child: const Text('Flip'),
                            ),
                            TextButton(
                              // The guidance sounds are camera-independent;
                              // prepare() once, then play to get the pet's
                              // attention.
                              onPressed: () => PetnowSound.play(
                                GuidanceSound.random,
                                widget.config.species,
                              ),
                              child: const Text('Sound'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
