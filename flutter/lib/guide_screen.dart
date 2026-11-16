import 'dart:async';

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:petnow_camera_ui/petnow_camera_ui.dart';

import 'camera_screen.dart';
import 'example_api.dart';
import 'petify_theme.dart';

/// The screen before the camera: the user reads it for a few seconds, which is
/// exactly the time prewarm needs.
class GuideScreen extends StatefulWidget {
  const GuideScreen({super.key, required this.camera, required this.flow});

  final PetnowCameraController camera;
  final CaptureFlow flow;

  @override
  State<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends State<GuideScreen> {
  late Future<String> _session;

  @override
  void initState() {
    super.initState();
    // ① Prewarm here, on the screen whose button leads to the camera. It
    //    validates the licence and loads the models now, so the camera screen
    //    only has to open the camera. Fire and forget: it returns at once and
    //    never throws (a bad key surfaces on the camera's onError instead).
    //    No species — an engine prepared without one serves whichever camera
    //    opens.
    unawaited(widget.camera.prewarm());
    // Your server issues the capture session (see ExampleApi.createSession).
    _session = widget.flow.createSession();
  }

  Future<void> _openCamera() async {
    // The SDK does not ask for the camera permission; the app does.
    final permission = await Permission.camera.request();
    if (!mounted) return;
    if (!permission.isGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Allow camera access to scan a nose print.'),
          // Permanently denied: the system will not ask again, so only the
          // app's settings page can grant it.
          action: permission.isPermanentlyDenied
              ? const SnackBarAction(
                  label: 'Open settings',
                  onPressed: openAppSettings,
                )
              : null,
        ),
      );
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CameraScreen(camera: widget.camera, flow: widget.flow),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final petId = widget.flow.petId;
    return Scaffold(
      appBar: AppBar(
        title: Text(switch (widget.flow.purpose) {
          DetectionPurpose.identification => 'Identify a pet',
          DetectionPurpose.registration => 'Register a pet',
          DetectionPurpose.verification => 'Verify a pet',
        }),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Before you start', style: theme.textTheme.headlineSmall),
              if (petId != null)
                Text(
                  'Pet ${shortPetId(petId)}',
                  style: const TextStyle(color: Petify.inkMuted),
                ),
              const SizedBox(height: 16),
              const _Tip(
                Icons.center_focus_strong,
                'Get close enough that the nose fills the frame.',
              ),
              const _Tip(
                Icons.wb_sunny_outlined,
                'Use soft, even light and avoid glare on the nose.',
              ),
              const _Tip(
                Icons.back_hand_outlined,
                'Hold still until the progress is complete.',
              ),
              const Spacer(),
              FutureBuilder<String>(
                future: _session,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Could not create a capture session: '
                          '${snapshot.error}',
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: () => setState(
                            () => _session = widget.flow.createSession(),
                          ),
                          child: const Text('Try again'),
                        ),
                      ],
                    );
                  }
                  if (!snapshot.hasData) {
                    return const Column(
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 8),
                        Text('Creating a capture session…'),
                      ],
                    );
                  }
                  return FilledButton(
                    onPressed: _openCamera,
                    child: const Text('Open camera'),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tip extends StatelessWidget {
  const _Tip(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Icon(icon, color: Petify.main),
            const SizedBox(width: 12),
            Expanded(child: Text(text)),
          ],
        ),
      );
}
