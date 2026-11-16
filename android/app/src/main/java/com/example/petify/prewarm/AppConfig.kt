package com.example.petify.prewarm

import io.petnow.ui.config.LicenseInfo

/** Values from local.properties, compiled into BuildConfig (see app/build.gradle.kts). */
object AppConfig {
    /** Null until `petnow.apiKey` is set in local.properties. */
    val apiKey: String? = BuildConfig.PETNOW_API_KEY
        .takeIf { it.isNotBlank() && it != "YOUR_PETNOW_API_KEY" }

    val license: LicenseInfo? get() = apiKey?.let { LicenseInfo(apiKey = it) }

    /** `example.serverUrl`, e.g. http://192.168.0.10:8787. Null when unset or not http(s). */
    val serverUrl: String? = BuildConfig.EXAMPLE_SERVER_URL.trim().trimEnd('/')
        .takeIf { it.startsWith("http://") || it.startsWith("https://") }

    /** `example.serverToken` — sent as a bearer token; never shown or logged. */
    val serverToken: String? = BuildConfig.EXAMPLE_SERVER_TOKEN
        .takeIf { it.isNotBlank() && it != "TOKEN_PRINTED_BY_THE_SERVER" }

    /** Server mode: both set. Otherwise camera-only mode. */
    val isServerMode: Boolean get() = serverUrl != null && serverToken != null

    /** Something was set for the server, but not both values (or not an http(s) URL). */
    val serverConfigIncomplete: Boolean
        get() = !isServerMode && (BuildConfig.EXAMPLE_SERVER_URL.isNotBlank() || serverToken != null)
}
