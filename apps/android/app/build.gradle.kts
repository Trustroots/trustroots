plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val configuredApiURL = providers.gradleProperty("trustrootsApiUrl")
    .orElse("https://www.trustroots.org")
val configuredMapboxToken = providers.gradleProperty("trustrootsMapboxToken")
    .orElse(providers.environmentVariable("TRUSTROOTS_MAPBOX_TOKEN"))
    .orElse("")
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

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.06.00")

    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.webkit:webkit:1.17.1")
    implementation("com.squareup.okhttp3:okhttp:5.3.2")
    implementation("org.osmdroid:osmdroid-android:6.1.20")
    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
