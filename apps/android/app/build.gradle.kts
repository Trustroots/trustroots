import org.gradle.api.tasks.testing.Test
import org.gradle.testing.jacoco.plugins.JacocoTaskExtension
import org.gradle.testing.jacoco.tasks.JacocoReport

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    jacoco
}

val coverageEnabled = providers.gradleProperty("trustrootsCoverage").map(String::toBoolean).orElse(false)
val coverageToolVersion = "0.8.15"
jacoco { toolVersion = coverageToolVersion }

tasks.withType<Test>().configureEach {
    extensions.configure<JacocoTaskExtension> {
        // Robolectric sandbox classes have no CodeSource; keep JaCoCo's exclusion limited to JDK internals.
        isIncludeNoLocationClasses = true
        excludes = listOf("jdk.internal.*")
    }
}
val configuredApiURL = providers.gradleProperty("trustrootsApiUrl")
    .orElse("https://www.trustroots.org")
val configuredMapboxToken = providers.gradleProperty("trustrootsMapboxToken")
    .orElse(providers.environmentVariable("TRUSTROOTS_MAPBOX_TOKEN"))
    .orElse("")
val previewUpdateAlerts = providers.gradleProperty("trustrootsPreviewUpdateAlerts")
    .map { it == "true" }
    .orElse(false)
val buildEpochSeconds = providers.exec {
    commandLine("date", "+%s")
}.standardOutput.asText.map(String::trim)
val releaseKeystorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS")
val releaseKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD")
val releaseSigningConfigured = listOf(
    releaseKeystorePath,
    releaseKeystorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { it.isPresent }

android {
    namespace = "org.trustroots.android"
    compileSdk = 37
    testCoverage { jacocoVersion = coverageToolVersion }

    defaultConfig {
        applicationId = "org.trustroots.android"
        minSdk = 26
        targetSdk = 37
        versionCode = providers.environmentVariable("ANDROID_VERSION_CODE")
            .map { it.toInt() }.orElse(1).get()
        versionName = providers.environmentVariable("ANDROID_VERSION_NAME")
            .orElse("0.1.0").get()
        buildConfigField("String", "API_BASE_URL", "\"${configuredApiURL.get()}\"")
        buildConfigField("String", "MAPBOX_PUBLIC_TOKEN", "\"${configuredMapboxToken.get()}\"")
        buildConfigField("long", "BUILD_EPOCH_SECONDS", "${buildEpochSeconds.get()}L")
        buildConfigField("boolean", "PREVIEW_UPDATE_ALERTS", "false")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("previewRelease") {
                storeFile = file(releaseKeystorePath.get())
                storePassword = releaseKeystorePassword.get()
                keyAlias = releaseKeyAlias.get()
                keyPassword = releaseKeyPassword.get()
            }
        }
    }

    buildTypes {
        debug {
            enableUnitTestCoverage = coverageEnabled.get()
            enableAndroidTestCoverage = coverageEnabled.get()
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-dev"
        }
        release {
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("previewRelease")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("String", "API_BASE_URL", "\"https://www.trustroots.org\"")
            buildConfigField("boolean", "PREVIEW_UPDATE_ALERTS", previewUpdateAlerts.get().toString())
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

// Combine host-side unit tests and device journeys against the same debug classes.
val debugCoverageReport = tasks.register<JacocoReport>("debugCoverageReport") {
    val collectCoverage = coverageEnabled
    group = "verification"
    description = "Combine Android unit and device test coverage (requires -PtrustrootsCoverage=true)."
    dependsOn("testDebugUnitTest", "connectedDebugAndroidTest")
    dependsOn("compileDebugKotlin", "compileDebugJavaWithJavac")
    sourceDirectories.setFrom(files("src/main/java"))
    classDirectories.setFrom(
        fileTree(layout.buildDirectory.dir("intermediates/built_in_kotlinc/debug/compileDebugKotlin/classes")) {
            exclude("**/R.class", "**/R\$*.class", "**/BuildConfig.class")
        },
        fileTree(layout.buildDirectory.dir("intermediates/javac/debug/compileDebugJavaWithJavac/classes")) {
            exclude("**/R.class", "**/R\$*.class", "**/BuildConfig.class")
        },
    )
    executionData.setFrom(fileTree(layout.buildDirectory) {
        include("outputs/unit_test_code_coverage/debugUnitTest/*.exec")
        include("outputs/code_coverage/debugAndroidTest/connected/**/*.ec")
    })
    reports {
        xml.required.set(true)
        html.required.set(true)
        xml.outputLocation.set(layout.buildDirectory.file("reports/coverage/debug/coverage.xml"))
        html.outputLocation.set(layout.buildDirectory.dir("reports/coverage/debug/html"))
    }
    doFirst {
        check(collectCoverage.get()) { "Pass -PtrustrootsCoverage=true to collect Android coverage." }
        check(executionData.files.any { it.isFile }) { "No Android coverage execution data was collected." }
    }
}

tasks.register<Exec>("debugCoverageTable") {
    group = "verification"
    description = "Write a Markdown table of measured Android source coverage."
    dependsOn(debugCoverageReport)
    commandLine(
        "python3", "../scripts/coverage-table.py",
        layout.buildDirectory.file("reports/coverage/debug/coverage.xml").get().asFile,
        layout.buildDirectory.file("reports/coverage/debug/coverage.md").get().asFile,
    )
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.06.00")

    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.navigation3:navigation3-runtime:1.2.0")
    implementation("androidx.navigation3:navigation3-ui:1.2.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-navigation3:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.9.0")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("org.unifiedpush.android:connector:3.3.5")
    implementation("androidx.webkit:webkit:1.17.1")
    implementation("com.squareup.okhttp3:okhttp:5.3.2")
    implementation("org.osmdroid:osmdroid-android:6.1.20")
    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("org.robolectric:robolectric:4.17")
    testImplementation("com.squareup.okhttp3:mockwebserver3:5.3.2")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.test:rules:1.7.0")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
