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
    }
}

rootProject.name = "TrustrootsAndroid"
include(":app", ":shared", ":coverage-report-tool")
project(":shared").projectDir = file("../shared")
project(":coverage-report-tool").projectDir = file("scripts/coverage-java")
