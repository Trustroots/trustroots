plugins {
    java
}

dependencies {
    implementation("org.jacoco:org.jacoco.core:0.8.15")
    implementation("org.jacoco:org.jacoco.report:0.8.15")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<JavaCompile>().configureEach { options.release.set(17) }

tasks.register<JavaExec>("regressionTest") {
    dependsOn(tasks.testClasses)
    classpath = sourceSets.test.get().output + sourceSets.main.get().output + configurations.testRuntimeClasspath.get()
    mainClass.set("org.jacoco.core.internal.analysis.filter.TrustrootsGeneratedCodeFilterRegression")
}
