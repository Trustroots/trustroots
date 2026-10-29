package org.trustroots.android.coverage;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import org.jacoco.core.data.ExecutionData;
import org.jacoco.core.data.ExecutionDataWriter;
import org.jacoco.core.data.SessionInfo;
import org.jacoco.core.internal.data.CRC64;
import org.jacoco.core.instr.Instrumenter;
import org.jacoco.core.runtime.IExecutionDataAccessorGenerator;
import org.jacoco.core.runtime.OfflineInstrumentationAccessGenerator;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

/** End-to-end checks for the filtered report CLI's fail-closed guarantees. */
public final class FilteredReportIntegrationRegression {
    private static final String CLASS_NAME = "sample/ReportFixture";

    private FilteredReportIntegrationRegression() {}

    public static void run() throws Exception {
        Path root = Files.createTempDirectory(Path.of("build/tmp"), "coverage-report-cli-");
        try {
            verifyRawBytesAndCountersAreStable(root);
            verifyMismatchedProbeIdentityFailsClosed(root);
            verifyBranchCounterMismatchFailsClosed(root);
        } finally {
            deleteTree(root);
        }
    }

    private static void verifyRawBytesAndCountersAreStable(Path root) throws Exception {
        Fixture fixture = fixture(root.resolve("stable"), rawReport(1, 1), executionData(true));
        byte[] rawBefore = Files.readAllBytes(fixture.rawReport);
        FilteredReport.main(fixture.arguments());
        byte[] firstFiltered = Files.readAllBytes(fixture.filteredReport);
        FilteredReport.main(fixture.arguments());
        byte[] secondFiltered = Files.readAllBytes(fixture.filteredReport);
        check(Arrays.equals(rawBefore, Files.readAllBytes(fixture.rawReport)),
                "the CLI must leave raw JaCoCo XML byte-for-byte unchanged");
        check(Arrays.equals(firstFiltered, secondFiltered),
                "the same execution data must produce deterministic filtered XML");
        check(new String(firstFiltered, StandardCharsets.UTF_8).contains("type=\"BRANCH\" missed=\"1\" covered=\"1\""),
                "filtered report must retain the raw branch counters");
    }

    private static void verifyMismatchedProbeIdentityFailsClosed(Path root) throws Exception {
        Fixture fixture = fixture(root.resolve("probe-mismatch"), rawReport(1, 1),
                executionData(false));
        byte[] rawBefore = Files.readAllBytes(fixture.rawReport);
        Files.writeString(fixture.filteredReport, "stale report");
        Files.writeString(fixture.audit, "stale audit");
        try {
            FilteredReport.main(fixture.arguments());
            throw new AssertionError("probe/class identity mismatch should fail the report");
        } catch (IOException expected) {
            check(expected.getMessage().contains("do not match"),
                    "probe mismatch should identify execution-data/class identity mismatch");
        }
        check(Arrays.equals(rawBefore, Files.readAllBytes(fixture.rawReport)),
                "a probe mismatch must preserve raw JaCoCo XML");
        check(!Files.exists(fixture.filteredReport), "a probe mismatch must not leave a filtered report");
        check(!Files.exists(fixture.audit), "a probe mismatch must not leave a stale audit");
    }

    private static void verifyBranchCounterMismatchFailsClosed(Path root) throws Exception {
        Fixture fixture = fixture(root.resolve("branch-mismatch"), rawReport(0, 2), executionData(true));
        byte[] rawBefore = Files.readAllBytes(fixture.rawReport);
        Files.writeString(fixture.filteredReport, "stale report");
        Files.writeString(fixture.audit, "stale audit");
        try {
            FilteredReport.main(fixture.arguments());
            throw new AssertionError("a raw/filtered branch mismatch should fail the report");
        } catch (IllegalStateException expected) {
            check(expected.getMessage().contains("changed branch counters"),
                    "branch mismatch should report the invariant that failed");
        }
        check(Arrays.equals(rawBefore, Files.readAllBytes(fixture.rawReport)),
                "a branch mismatch must preserve raw JaCoCo XML");
        check(!Files.exists(fixture.filteredReport), "a branch mismatch must delete the invalid filtered report");
        check(!Files.exists(fixture.audit), "a branch mismatch must not leave a stale audit");
    }

    private static Fixture fixture(Path root, String raw, ExecutionData executionData) throws IOException {
        Path exec = root.resolve("execution");
        Path classes = root.resolve("classes");
        Path sources = root.resolve("sources");
        Files.createDirectories(exec);
        Files.createDirectories(classes.resolve("sample"));
        Files.createDirectories(sources);
        Files.write(classes.resolve(CLASS_NAME + ".class"), classBytes());
        Files.writeString(root.resolve("raw.xml"), raw, StandardCharsets.UTF_8);
        try (var output = Files.newOutputStream(exec.resolve("fixture.exec"))) {
            ExecutionDataWriter writer = new ExecutionDataWriter(output);
            writer.visitSessionInfo(new SessionInfo("coverage-regression", 1, 2));
            if (executionData != null) writer.visitClassExecution(executionData);
            writer.flush();
        }
        return new Fixture(exec, classes, sources, root.resolve("raw.xml"), root.resolve("filtered.xml"),
                root.resolve("audit.txt"));
    }

    private static byte[] classBytes() {
        ClassWriter writer = new ClassWriter(0);
        writer.visit(Opcodes.V17, Opcodes.ACC_PUBLIC, CLASS_NAME, null, "java/lang/Object", null);
        MethodVisitor method = writer.visitMethod(Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC, "run", "()V", null, null);
        method.visitCode();
        org.objectweb.asm.Label falseBranch = new org.objectweb.asm.Label();
        method.visitInsn(Opcodes.ICONST_0);
        method.visitJumpInsn(Opcodes.IFEQ, falseBranch);
        method.visitInsn(Opcodes.RETURN);
        method.visitLabel(falseBranch);
        method.visitInsn(Opcodes.RETURN);
        method.visitMaxs(0, 0);
        method.visitEnd();
        writer.visitEnd();
        return writer.toByteArray();
    }

    private static ExecutionData executionData(boolean matchingClassId) throws IOException {
        byte[] bytes = classBytes();
        ProbeCount probeCount = new ProbeCount();
        new Instrumenter(probeCount).instrument(bytes, "generated coverage regression fixture");
        long classId = CRC64.classId(bytes) + (matchingClassId ? 0 : 1);
        boolean[] probes = new boolean[probeCount.value];
        if (probes.length > 0) probes[0] = true;
        return new ExecutionData(classId, CLASS_NAME, probes);
    }

    private static String rawReport(int missedBranches, int coveredBranches) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<!DOCTYPE report PUBLIC \"-//JACOCO//DTD Report 1.1//EN\" \"report.dtd\">"
                + "<report name=\"fixture\"><counter type=\"BRANCH\" missed=\"" + missedBranches
                + "\" covered=\"" + coveredBranches + "\"/></report>";
    }

    private static void deleteTree(Path root) throws IOException {
        if (!Files.exists(root)) return;
        try (var paths = Files.walk(root)) {
            for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static final class ProbeCount implements IExecutionDataAccessorGenerator {
        private final OfflineInstrumentationAccessGenerator delegate = new OfflineInstrumentationAccessGenerator();
        private int value;

        @Override
        public int generateDataAccessor(long classId, String className, int probeCount,
                org.objectweb.asm.MethodVisitor methodVisitor) {
            value = probeCount;
            return delegate.generateDataAccessor(classId, className, probeCount, methodVisitor);
        }
    }

    private record Fixture(Path execution, Path classes, Path sources, Path rawReport,
            Path filteredReport, Path audit) {
        String[] arguments() {
            return new String[] { execution.toString(), classes.toString(), sources.toString(), rawReport.toString(),
                    filteredReport.toString(), audit.toString() };
        }
    }
}
