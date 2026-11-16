import 'dart:io';

import 'package:flutter/material.dart';
import 'package:petnow_camera_ui/petnow_camera_ui.dart';

import 'example_api.dart';
import 'petify_theme.dart';

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

/// What the server said: a title, coloured as a success or not, and details.
typedef _Outcome = ({String title, bool ok, List<String> lines, String? note});

class _ResultScreenState extends State<ResultScreen> {
  bool _busy = false;
  String? _step;
  _Outcome? _outcome;

  void _show(String step) {
    if (mounted) setState(() => _step = step);
  }

  /// Server mode: upload every image, then register, verify or identify.
  Future<void> _send() async {
    final flow = widget.flow;
    final api = flow.api;
    final sessionId = flow.sessionId!;
    setState(() => _busy = true);
    _Outcome outcome;
    try {
      await api.upload(sessionId, widget.result,
          (done, total) => _show('Uploading image ${done + 1} of $total…'));
      switch (flow.purpose) {
        case DetectionPurpose.registration:
          _show('Registering…');
          final r = await api.register(sessionId);
          flow.registered = r['status'] == 'SUCCESS';
          outcome = flow.registered
              ? (
                  title: 'Pet registered',
                  ok: true,
                  lines: ['petId ${r['petId']}'],
                  note: null,
                )
              : (
                  title: 'Registration ${r['status']}',
                  ok: false,
                  lines: const [],
                  note: null,
                );
        case DetectionPurpose.verification:
          _show('Verifying…');
          final r = await api.verify(sessionId);
          final verified = r['isVerified'];
          outcome = r['status'] != 'SUCCESS' || verified == null
              ? (
                  title: 'Verification ${r['status']}',
                  ok: false,
                  lines: const [],
                  note: null,
                )
              : (
                  title: verified == true ? 'Same pet' : 'Not the same pet',
                  ok: verified == true,
                  lines: ['petId ${r['petId']}', 'score ${r['score']}'],
                  note: "The server's decision is the answer, not the score.",
                );
        case DetectionPurpose.identification:
          _show('Identifying…');
          final r = await api.identify(sessionId);
          final candidates = (r['candidates'] as List? ?? const []).cast<Map>();
          outcome = r['status'] != 'SUCCESS'
              ? (
                  title: 'Identification ${r['status']}',
                  ok: false,
                  lines: const [],
                  note: null,
                )
              : candidates.isEmpty
                  ? (title: 'No match', ok: false, lines: const [], note: null)
                  : (
                      title: 'Top candidates',
                      ok: true,
                      lines: [
                        for (final c in candidates.take(5))
                          '${c['petId']} · ${c['score']}'
                              '${c['isMatch'] == true ? '  ✓ match' : ''}',
                      ],
                      note: null,
                    );
      }
    } catch (e) {
      outcome = (title: 'Request failed', ok: false, lines: ['$e'], note: null);
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
                _OutcomeView(outcome),
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

class _OutcomeView extends StatelessWidget {
  const _OutcomeView(this.outcome);

  final _Outcome outcome;

  @override
  Widget build(BuildContext context) {
    final color = outcome.ok ? Petify.success : Petify.error;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(outcome.ok ? Icons.check_circle : Icons.cancel, color: color),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                outcome.title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final line in outcome.lines)
          Text(line, style: const TextStyle(color: Petify.ink)),
        if (outcome.note != null) ...[
          const SizedBox(height: 8),
          Text(
            outcome.note!,
            style: const TextStyle(fontSize: 12, color: Petify.inkMuted),
          ),
        ],
      ],
    );
  }
}
