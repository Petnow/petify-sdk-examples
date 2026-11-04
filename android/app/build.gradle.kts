import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.parcelize") // the saved back stack (MainActivity.kt)
}

// The API key is read from local.properties (git-ignored) or the PETNOW_API_KEY
// environment variable and compiled into BuildConfig. Fine for an example; see
// README.md for what a production app should do instead.
val localProperties = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}
val petnowApiKey: String = localProperties.getProperty("petnow.apiKey")
    ?: System.getenv("PETNOW_API_KEY")
    ?: ""

android {
    namespace = "com.example.petify.prewarm"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.petify.prewarm"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "PETNOW_API_KEY", "\"${petnowApiKey.replace("\"", "\\\"")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Debug signing so `assembleRelease` installs without a keystore. An example only.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
}

dependencies {
    implementation("io.petnow:ui:1.6.0")

    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
