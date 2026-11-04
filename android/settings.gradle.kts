pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

// Stop here with a clear message: without the variables Gradle would fail later on
// every dependency with an error that does not say what is missing.
fun requireEnv(name: String): String = System.getenv(name)?.takeIf { it.isNotBlank() }
    ?: error("$name is not set — see README.md step 2 (and start Android Studio from that shell)")

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // The Petnow SDK (io.petnow:ui), from AWS CodeArtifact. Same block as the
        // Android Getting Started guide; CODEARTIFACT_URL and CODEARTIFACT_AUTH_TOKEN
        // come from the Petify Console credentials (see README.md).
        maven {
            name = "CodeArtifact"
            url = uri(requireEnv("CODEARTIFACT_URL"))
            credentials {
                username = "aws"
                password = requireEnv("CODEARTIFACT_AUTH_TOKEN")
            }
        }
    }
}

rootProject.name = "PrewarmExample"
include(":app")
