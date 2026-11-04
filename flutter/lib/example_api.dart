/// Configuration and every network call the example makes.
///
/// The app holds a **Client key (app)** only. A Client key may run the SDK,
/// create a capture session and upload images — nothing else. Registering,
/// verifying and identifying need a Secret key (server), and that lives in the
/// example server (`server/` in the examples repository), never in an app.
library;

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:petnow_camera_ui/petnow_camera_ui.dart';

/// Values from `.env`, compiled in by `--dart-define-from-file=.env`.
class AppConfig {
  const AppConfig({
    required this.apiKey,
    this.serverUrl = '',
    this.serverToken = '',
  });

  const AppConfig.fromEnvironment()
      : apiKey = const String.fromEnvironment('PETIFY_API_KEY'),
        serverUrl = const String.fromEnvironment('EXAMPLE_SERVER_URL'),
        serverToken = const String.fromEnvironment('EXAMPLE_SERVER_TOKEN');

  /// Client key (app) from the Petify Console. Required.
  final String apiKey;

  /// The example server, e.g. `http://192.168.0.10:8787`. Unset: camera-only
  /// mode. Set (with [serverToken]): server mode, which can also register,
  /// verify and identify.
  final String serverUrl;

  /// The token the example server prints at start.
  final String serverToken;

  /// Server mode needs both values.
  bool get serverMode => serverUrl.isNotEmpty && serverToken.isNotEmpty;

  /// Only one of the two server values is set: a typo, not a choice.
  bool get serverHalfSet => serverUrl.isNotEmpty != serverToken.isNotEmpty;
}

/// A failed call, shown as `HTTP <status> <code>: <message>`.
class ApiException implements Exception {
  const ApiException(this.status, this.code, this.message);

  final int? status;
  final String code;
  final String message;

  @override
  String toString() =>
      status == null ? '$code: $message' : 'HTTP $status $code: $message';
}

const String kPetifyApi = 'https://api.petify.petnow.io';
const Duration _jsonTimeout = Duration(seconds: 15);
const Duration _longTimeout = Duration(seconds: 60);

class ExampleApi {
  ExampleApi(this.config, {http.Client? client})
      : _http = client ?? http.Client();

  final AppConfig config;
  final http.Client _http;

  bool get serverMode => config.serverMode;

  /// Creates a capture session for [purpose] and returns its id. A
  /// verification names the registered pet it checks against: [petId].
  Future<String> createSession(DetectionPurpose purpose,
      {String? petId}) async {
    if (!serverMode) {
      // Camera-only mode: the app creates an identification session itself.
      // This is allowed for a Client key; in production your server creates
      // sessions. (For a cat, send "CAT" — see CameraScreen.)
      final body = await _call(
        () => _http.post(
          Uri.parse('$kPetifyApi/v2/capture-sessions'),
          headers: {
            'x-petnow-api-key': config.apiKey,
            'content-type': 'application/json',
          },
          body: jsonEncode({'species': 'DOG', 'purpose': 'PET_IDENTIFICATION'}),
        ),
      );
      return (body['data'] as Map)['id'] as String;
    }
    // Server mode. For a registration the server first creates the pet.
    final body = await _server('POST', '/sessions', body: {
      'purpose': switch (purpose) {
        DetectionPurpose.registration => 'register',
        DetectionPurpose.verification => 'verify',
        DetectionPurpose.identification => 'identify',
      },
      'species': 'DOG',
      if (petId != null) 'petId': petId,
    });
    return body['sessionId'] as String;
  }

  /// Server mode: the IDs of the pets this example registered, newest first
  /// (up to 20). A Client key cannot list pets, so camera-only mode has none.
  Future<List<String>> listPets() async {
    final body = await _server('GET', '/pets');
    return [
      for (final pet in (body['pets'] as List? ?? const []).cast<Map>())
        pet['petId'] as String,
    ];
  }

  /// Uploads every image of [result] through the example server.
  Future<void> upload(
    String sessionId,
    CameraResult result,
    void Function(int done, int total) onProgress,
  ) async {
    final files = [
      for (final path in result.fingerprintImages) ('fingerprints', path),
      for (final path in result.appearanceImages) ('appearances', path),
    ];
    for (final (index, (kind, path)) in files.indexed) {
      onProgress(index, files.length);
      final request = http.MultipartRequest(
        'POST',
        _serverUri('/sessions/$sessionId/$kind'),
      )
        ..headers['authorization'] = 'Bearer ${config.serverToken}'
        ..files.add(await http.MultipartFile.fromPath(
          'file',
          path,
          contentType: http.MediaType('image', 'jpeg'),
        ));
      await _call(
        () async => http.Response.fromStream(await _http.send(request)),
        timeout: _longTimeout,
      );
    }
  }

  /// `{status, petId}`. The server polls the job for up to 30 s.
  Future<Map<String, dynamic>> register(String sessionId) =>
      _server('POST', '/sessions/$sessionId/register', timeout: _longTimeout);

  /// `{status, petId, isVerified, score}`; isVerified and score are null when
  /// the job failed.
  Future<Map<String, dynamic>> verify(String sessionId) =>
      _server('POST', '/sessions/$sessionId/verify', timeout: _longTimeout);

  /// `{status, candidates: [{petId, score}]}`.
  Future<Map<String, dynamic>> identify(String sessionId) =>
      _server('POST', '/sessions/$sessionId/identify', timeout: _longTimeout);

  /// Fire and forget: the server deletes the pet it created for a
  /// registration that did not succeed.
  void deleteSession(String sessionId) {
    unawaited(
      _server('DELETE', '/sessions/$sessionId').then((_) {}, onError: (_) {}),
    );
  }

  Uri _serverUri(String path) =>
      Uri.parse(config.serverUrl.replaceAll(RegExp(r'/+$'), '') + path);

  Future<Map<String, dynamic>> _server(
    String method,
    String path, {
    Map<String, Object?>? body,
    Duration timeout = _jsonTimeout,
  }) {
    final request = http.Request(method, _serverUri(path))
      ..headers['authorization'] = 'Bearer ${config.serverToken}';
    if (body != null) {
      request
        ..headers['content-type'] = 'application/json'
        ..body = jsonEncode(body);
    }
    return _call(
      () async => http.Response.fromStream(await _http.send(request)),
      timeout: timeout,
    );
  }

  /// Runs one request and returns its JSON body, or throws [ApiException].
  /// Never logs a request: its headers carry the key or the token.
  Future<Map<String, dynamic>> _call(
    Future<http.Response> Function() send, {
    Duration timeout = _jsonTimeout,
  }) async {
    final http.Response response;
    try {
      response = await send().timeout(timeout);
    } on TimeoutException {
      throw ApiException(
          null, 'timeout', 'No answer in ${timeout.inSeconds} s');
    }
    Map<String, dynamic> json = const {};
    try {
      json = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      // Empty (204) or not JSON.
    }
    if (response.statusCode >= 300) {
      // The example server answers {error, message}; Petify {errors: [{code}]}.
      final petify = (json['errors'] as List?)?.firstOrNull as Map?;
      throw ApiException(
        response.statusCode,
        '${json['error'] ?? petify?['code'] ?? 'error'}',
        '${json['message'] ?? petify?['message'] ?? response.reasonPhrase ?? ''}',
      );
    }
    return json;
  }
}

/// One trip Home → guide → camera → result, so Home can clean up after it.
class CaptureFlow {
  CaptureFlow(this.api, this.purpose, {this.petId});

  final ExampleApi api;
  final DetectionPurpose purpose;

  /// The pet a verification checks against; null otherwise.
  final String? petId;

  String? sessionId;

  /// The server registered the pet: nothing to clean up.
  bool registered = false;

  bool _closed = false;

  bool get isRegistration => purpose == DetectionPurpose.registration;

  Future<String> createSession() async {
    final id = await api.createSession(purpose, petId: petId);
    sessionId = id;
    if (_closed) close(); // the user left while the session was being created
    return id;
  }

  /// Called once the user is back on Home. Leaving a registration without a
  /// successful register — Back, Close or Done before Send, or a failed
  /// register — deletes the pet the server created for it.
  void close() {
    _closed = true;
    final id = sessionId;
    if (isRegistration && !registered && id != null) {
      sessionId = null;
      api.deleteSession(id);
    }
  }
}
