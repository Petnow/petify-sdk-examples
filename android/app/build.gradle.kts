import java.net.URI
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

// Optional example server (../server). Both unset = camera-only mode.
val exampleServerUrl: String = localProperties.getProperty("example.serverUrl")
    ?: System.getenv("EXAMPLE_SERVER_URL")
    ?: ""
val exampleServerToken: String = localProperties.getProperty("example.serverToken")
    ?: System.getenv("EXAMPLE_SERVER_TOKEN")
    ?: ""

fun String.quoted() = "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

// Plain HTTP is allowed to the example server's host and nowhere else. The host is
// only known from local.properties, so res/xml/network_security_config.xml is written
// at build time: a domain-config naming that host (an IP literal matches like a host
// name, as with the emulator's 10.0.2.2), or no exception at all without a server.
// Unlike usesCleartextTraffic in a debug manifest, this also works in a release build
// and opens nothing else.
val exampleServerHttpHost: String = runCatching { URI(exampleServerUrl.trim()) }.getOrNull()
    ?.takeIf { it.scheme == "http" }?.host.orEmpty()

abstract class NetworkSecurityConfigTask : DefaultTask() {
    @get:Input abstract val cleartextHost: Property<String>
    @get:OutputDirectory abstract val outputDir: DirectoryProperty

    @TaskAction
    fun write() {
        val host = cleartextHost.get()
        val domainConfig = if (host.isEmpty()) "" else
            "    <domain-config cleartextTrafficPermitted=\"true\">\n" +
                "        <domain includeSubdomains=\"false\">$host</domain>\n" +
                "    </domain-config>\n"
        outputDir.file("xml/network_security_config.xml").get().asFile.apply {
            parentFile.mkdirs()
            writeText("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<network-security-config>\n$domainConfig</network-security-config>\n")
        }
    }
}

val networkSecurityConfig = tasks.register<NetworkSecurityConfigTask>("networkSecurityConfig") {
    cleartextHost.set(exampleServerHttpHost) // outputDir is set by addGeneratedSourceDirectory below
}

android {
    namespace = "com.example.petify.prewarm"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.petify.prewarm"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "PETNOW_API_KEY", petnowApiKey.quoted())
        buildConfigField("String", "EXAMPLE_SERVER_URL", exampleServerUrl.quoted())
        buildConfigField("String", "EXAMPLE_SERVER_TOKEN", exampleServerToken.quoted())
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

androidComponents {
    onVariants { variant ->
        variant.sources.res?.addGeneratedSourceDirectory(networkSecurityConfig, NetworkSecurityConfigTask::outputDir)
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
