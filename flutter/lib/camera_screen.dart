import 'package:flutter/material.dart';
import 'package:petnow_camera_ui/petnow_camera_ui.dart';

import 'example_api.dart';
import 'petnow_guidance.dart';
import 'result_screen.dart';

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key, required this.camera, required this.flow});

  final PetnowCameraController camera;
  final CaptureFlow flow;

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen>
    with WidgetsBindingObserver {
  // Dog only. To scan cats, use Species.cat here and "CAT" when the session
  // is created (ExampleApi.createSession).
  late final PetnowCameraConfig _config = PetnowCameraConfig(
    species: Species.dog,
    purpose: widget.flow.purpose,
    captureSessionId: widget.flow.sessionId!,
  );

  DetectionStatus? _status;
  int _progress = 0;
  CameraPerformanceStats? _stats;
  PetnowCameraError? _error;
  bool _mountView = false;

  bool get _detectionReady => _stats?.detectionReadyAtMs != null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _mountWhenSettled());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Creates the camera view once the push animation has finished: the native
  /// camera start holds the platform thread for a moment and would stall it.
  void _mountWhenSettled() {
    if (!mounted) return;
    final animation = ModalRoute.of(context)?.animation;
    if (animation == null || animation.isCompleted) {
      setState(() => _mountView = true);
      return;
    }
    void onStatus(AnimationStatus status) {
      if (status != AnimationStatus.completed) return;
      animation.removeStatusListener(onStatus);
      if (mounted) setState(() => _mountView = true);
    }

    animation.addStatusListener(onStatus);
  }

  // Stop detecting while the app is in the background; pick up on return.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.camera.resumeDetection();
    } else {
      widget.camera.pauseDetection();
    }
  }

  void _onStats(CameraPerformanceStats stats) {
    final wasReady = _detectionReady;
    _stats = stats;
    if (!wasReady && _detectionReady) setState(() {});
  }

  void _onFinished(CameraResult result) {
    // A late callback, after the user closed the camera, opens nothing.
    if (!mounted || !(ModalRoute.of(context)?.isCurrent ?? false)) return;
    if (!result.success) {
      // Since 1.6.0 the failed capture's reason is on the result, not on
      // onDetectionStatus.
      _offerRetry(result.failureReason);
      return;
    }
    // ⑤ engineReused: the engine was already built when the camera started —
    //    true after a finished prewarm or when an earlier camera left one;
    //    false when this camera built it (on iOS, also when it joined a
    //    prewarm still building).
    final engineReused = _stats?.engineReused ?? false;
    debugPrint('[Petify] engineReused=$engineReused '
        'detectionReadyAtMs=${_stats?.detectionReadyAtMs}');
    // The result replaces the camera, so nothing leads back to a used capture.
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => ResultScreen(
          flow: widget.flow,
          result: result,
          engineReused: engineReused,
        ),
      ),
    );
  }

  Future<void> _offerRetry(DetectionFailureReason? reason) async {
    final again = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Capture failed'),
        content: Text(failureMessage(reason)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Leave'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Try again'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (again != true) {
      Navigator.of(context).pop();
      return;
    }
    // ③ Retry with startDetection(): the camera stays open, on the same
    //    capture session, so there is no new session and no remount.
    setState(() {
      _status = null;
      _progress = 0;
    });
    await widget.camera.startDetection();
  }

  // ② Guide from detection feedback, not from the preview appearing. Since
  //    1.6.0 the preview is up before the models are ready;
  //    detectionReadyAtMs marks the moment detection begins. With a prewarm
  //    that is almost immediate.
  String get _guidance =>
      _detectionReady ? guidanceFor(_status) : 'Getting ready…';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final error = _error;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_mountView)
            PetnowCameraView(
              controller: widget.camera,
              config: _config,
              onDetectionStatus: (s) => setState(() => _status = s),
              onDetectionProgress: (p) => setState(() => _progress = p),
              onDetectionFinished: _onFinished,
              // What stops the camera: a refused key, a missing permission, a
              // camera that would not open — never reported by prewarm.
              onError: (e) => setState(() => _error = e),
              onPerformanceStats: _onStats,
            ),
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: IconButton.filledTonal(
                  icon: const Icon(Icons.close),
                  tooltip: 'Close camera',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: error != null
                    ? Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Camera could not start',
                            style: theme.textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Text('${error.code.name}: ${error.message}'),
                          TextButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('OK'),
                          ),
                        ],
                      )
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_guidance, style: theme.textTheme.titleMedium),
                          const SizedBox(height: 8),
                          LinearProgressIndicator(value: _progress / 100),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
