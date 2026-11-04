import 'dart:io';

import 'package:flutter/material.dart';
import 'package:petnow_camera_ui/petnow_camera_ui.dart';

import 'example_api.dart';

class ResultScreen extends StatefulWidget {
  const ResultScreen({
    super.key,
    required this.flow,
    required this.result,
    required this.engineReused,
  });

  final CaptureFlow flow;
  final CameraResult result;
  final bool engineReused;

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  bool _busy = false;
  String? _step;
  List<String>? _outcome;
  bool _failed = false;

  void _show(String step) {
    if (mounted) setState(() => _step = step);
  }

  /// Server mode: upload every image, then register or identify.
  Future<void> _send() async {
    final flow = widget.flow;
    final api = flow.api;
    final sessionId = flow.sessionId!;
    setState(() => _busy = true);
    List<String> outcome;
    try {
      await api.upload(sessionId, widget.result,
          (done, total) => _show('Uploading image ${done + 1} of $total…'));
      if (flow.isRegistration) {
        _show('Registering…');
        final r = await api.register(sessionId);
        flow.registered = r['status'] == 'SUCCESS';
        outcome = flow.registered
            ? ['Registered pet ${r['petId']}']
            : ['Registration ${r['status']}'];
      } else {
        _show('Identifying…');
        final r = await api.identify(sessionId);
        final candidates = (r['candidates'] as List? ?? const []).cast<Map>();
        outcome = r['status'] != 'SUCCESS'
            ? ['Identification ${r['status']}']
            : candidates.isEmpty
                ? ['No match']
                : [
                    'Top candidates:',
                    for (final c in candidates.take(5))
                      '${c['petId']} · ${c['score']}'
                          '${c['isMatch'] == true ? '  ✓ match' : ''}',
                  ];
      }
      _failed = false;
    } catch (e) {
      outcome = ['$e'];
      _failed = true;
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
      _step = null;
      _outcome = outcome;
    });
  }

  void _done() => Navigator.of(context).popUntil((route) => route.isFirst);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final result = widget.result;
    final outcome = _outcome;
    return PopScope(
      // Back goes home, like Done: the capture is used up.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_busy) _done();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Result'),
          automaticallyImplyLeading: false,
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text('Nose images: ${result.fingerprintImages.length}'),
              Text('Appearance images: ${result.appearanceImages.length}'),
              // ⑤ Also printed to the console by the camera screen.
              Text('Engine ready at camera start: '
                  '${widget.engineReused ? 'Yes' : 'No'}'),
              if (result.fingerprintImages.isNotEmpty) ...[
                const SizedBox(height: 16),
                Image.file(
                  File(result.fingerprintImages.first),
                  height: 160,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ],
              const SizedBox(height: 24),
              if (!widget.flow.api.serverMode)
                Text(
                  'Run the example server to register or identify these '
                  'images (server/README)',
                  style: theme.textTheme.bodySmall,
                )
              else if (outcome == null)
                FilledButton(
                  onPressed: _busy ? null : _send,
                  child: Text(_step ?? 'Send'),
                )
              else
                for (final line in outcome)
                  Text(
                    line,
                    style: _failed
                        ? TextStyle(color: theme.colorScheme.error)
                        : null,
                  ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: _busy ? null : _done,
                child: const Text('Done'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
