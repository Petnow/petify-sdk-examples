allprojects {
    repositories {
        // Exactly what `flutter create` writes, on purpose: the example builds
        // the way a customer's app does. The petnow_camera_ui plugin adds the
        // SDK's own repository (the package's petnow-maven/, or mavenLocal in
        // the camera-framework checkout) — see its android/build.gradle.kts.
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
