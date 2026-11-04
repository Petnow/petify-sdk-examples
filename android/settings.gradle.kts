pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

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
            url = uri(System.getenv("CODEARTIFACT_URL") ?: "YOUR_REPOSITORY_URL")
            credentials {
                username = "aws"
                password = System.getenv("CODEARTIFACT_AUTH_TOKEN") ?: "YOUR_AUTH_TOKEN"
            }
        }
    }
}

rootProject.name = "PrewarmExample"
include(":app")
