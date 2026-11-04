package com.example.petify.prewarm

import io.petnow.ui.config.LicenseInfo

/** Values from local.properties, compiled into BuildConfig (see app/build.gradle.kts). */
object AppConfig {
    /** Null until `petnow.apiKey` is set in local.properties. */
    val apiKey: String? = BuildConfig.PETNOW_API_KEY
        .takeIf { it.isNotBlank() && it != "YOUR_PETNOW_API_KEY" }

    val license: LicenseInfo? get() = apiKey?.let { LicenseInfo(apiKey = it) }
}
