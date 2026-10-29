package org.trustroots.android.coverage;

import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import org.jacoco.core.analysis.Analyzer;
import org.jacoco.core.analysis.CoverageBuilder;
import org.jacoco.core.analysis.IClassCoverage;
import org.jacoco.core.data.ExecutionDataStore;
import org.jacoco.core.data.SessionInfoStore;
import org.jacoco.core.internal.analysis.filter.TrustrootsGeneratedCodeFilter;
import org.jacoco.core.tools.ExecFileLoader;
import org.jacoco.report.DirectorySourceFileLocator;
import org.jacoco.report.xml.XMLFormatter;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.ClassNode;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

/** Rebuilds an audited filtered report without changing the raw JaCoCo report. */
public final class FilteredReport {
    private FilteredReport() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 6) {
            throw new IllegalArgumentException(
                    "Usage: FilteredReport <exec-dir> <class-dir> <source-dir> <raw.xml> <filtered.xml> <audit.txt>");
        }
        final File executionData = new File(args[0]);
        final String classDirectories = args[1];
        final File sourceDirectory = new File(args[2]);
        final File rawReport = new File(args[3]);
        final File filteredReport = new File(args[4]);
        final File auditFile = new File(args[5]);
        final var rawPath = rawReport.toPath().toAbsolutePath().normalize();
        final var filteredPath = filteredReport.toPath().toAbsolutePath().normalize();
        final var auditPath = auditFile.toPath().toAbsolutePath().normalize();
        if (rawPath.equals(filteredPath) || rawPath.equals(auditPath) || filteredPath.equals(auditPath)) {
            throw new IllegalArgumentException("Raw, filtered, and audit output paths must be distinct");
        }
        Files.deleteIfExists(filteredPath);
        Files.deleteIfExists(auditPath);
        final int[] rawBranches = branchCounters(rawReport);
        System.setProperty("trustroots.coverage.sourceRoot", sourceDirectory.getAbsolutePath());

        final ExecFileLoader loader = new ExecFileLoader();
        final List<File> executions = executionFiles(executionData);
        if (executions.isEmpty()) throw new IOException("No .exec or .ec files found under " + executionData);
        for (File file : executions) {
            loader.load(file);
        }
        final CoverageBuilder coverage = new CoverageBuilder();
        TrustrootsGeneratedCodeFilter.clearAudit();
        EnumClassIndex enumClasses = indexEnumClasses(classDirectories);
        TrustrootsGeneratedCodeFilter.setEnumClassNames(enumClasses.names());
        TrustrootsGeneratedCodeFilter.setSingleEntryEnumClassNames(enumClasses.singleEntryNames());
        final Analyzer analyzer = new Analyzer(loader.getExecutionDataStore(), coverage);
        int analyzedClasses = 0;
        for (String path : classDirectories.split(java.util.regex.Pattern.quote(File.pathSeparator))) {
            analyzedClasses += analyzeClasses(analyzer, new File(path));
        }
        if (analyzedClasses == 0) {
            throw new IOException("No eligible class files found under " + classDirectories);
        }
        verifyExecutionClassIds(loader.getExecutionDataStore(), coverage.getClasses());
        if (!coverage.getNoMatchClasses().isEmpty()) {
            String mismatches = coverage.getNoMatchClasses().stream()
                    .map(classCoverage -> classCoverage.getName())
                    .sorted()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
            throw new IOException("Execution probes do not match the supplied class bytecode: " + mismatches);
        }
        writeReport(filteredReport, loader.getSessionInfoStore(), loader.getExecutionDataStore(), coverage,
                sourceDirectory);
        final int[] filteredBranches = branchCounters(filteredReport);
        int removedBranches = rawBranches[0] + rawBranches[1] - filteredBranches[0] - filteredBranches[1];
        int expectedRemovedBranches = TrustrootsGeneratedCodeFilter.filteredBranchOutcomeCount();
        if (rawBranches[0] < filteredBranches[0] || rawBranches[1] < filteredBranches[1]
                || removedBranches != expectedRemovedBranches) {
            Files.deleteIfExists(filteredReport.toPath());
            throw new IllegalStateException(
                    "Generated-code filtering changed branch counters without matching audited decisions: raw missed/covered "
                            + rawBranches[0] + "/" + rawBranches[1] + ", filtered "
                            + filteredBranches[0] + "/" + filteredBranches[1] + ", audited decisions "
                            + TrustrootsGeneratedCodeFilter.filteredBranchDecisionCount() + " conditional decisions and "
                            + (TrustrootsGeneratedCodeFilter.filteredBranchOutcomeCount()
                                    - TrustrootsGeneratedCodeFilter.filteredBranchDecisionCount() * 2)
                            + " enum switch default outcomes");
        }
        writeAudit(auditFile, TrustrootsGeneratedCodeFilter.auditEntries());
        System.out.println("Filtered report written: raw branches " + rawBranches[0] + " missed/"
                + rawBranches[1] + " covered; filtered " + filteredBranches[0] + "/"
                + filteredBranches[1] + "; audited branch decisions "
                + TrustrootsGeneratedCodeFilter.filteredBranchDecisionCount() + " and audited enum switch default outcomes "
                + (TrustrootsGeneratedCodeFilter.filteredBranchOutcomeCount()
                        - TrustrootsGeneratedCodeFilter.filteredBranchDecisionCount() * 2) + ".");
    }

    private static void verifyExecutionClassIds(ExecutionDataStore executionData,
            java.util.Collection<IClassCoverage> classes) throws IOException {
        Map<String, Set<Long>> classIds = new HashMap<>();
        for (IClassCoverage classCoverage : classes) {
            classIds.computeIfAbsent(classCoverage.getName(), unused -> new HashSet<>())
                    .add(classCoverage.getId());
        }
        for (var data : executionData.getContents()) {
            Set<Long> ids = classIds.get(data.getName());
            if (ids != null && !ids.contains(data.getId())) {
                throw new IOException("Execution probes do not match the supplied class bytecode: "
                        + data.getName());
            }
        }
    }

    private static List<File> executionFiles(File root) throws IOException {
        if (!root.exists()) throw new IOException("Execution data path does not exist: " + root);
        if (root.isFile()) return List.of(root);
        try (var paths = Files.walk(root.toPath())) {
            return paths.filter(Files::isRegularFile)
                    .filter(path -> path.toString().endsWith(".exec") || path.toString().endsWith(".ec"))
                    .map(path -> path.toFile()).sorted(Comparator.comparing(File::getPath)).toList();
        }
    }

    private static int analyzeClasses(Analyzer analyzer, File root) throws IOException {
        // Java class output can be absent for this Kotlin-only app module.
        if (!root.exists()) return 0;
        if (root.isDirectory()) {
            File[] children = root.listFiles();
            if (children == null) throw new IOException("Cannot list class directory: " + root);
            int count = 0;
            for (File child : children) count += analyzeClasses(analyzer, child);
            return count;
        }
        String name = root.getName();
        if (!name.endsWith(".class") || name.equals("R.class") || name.startsWith("R$")
                || name.equals("BuildConfig.class")) return 0;
        analyzer.analyzeAll(root);
        return 1;
    }

    private static EnumClassIndex indexEnumClasses(String classDirectories) throws IOException {
        Set<String> enumClassNames = new HashSet<>();
        Set<String> singleEntryEnumClassNames = new HashSet<>();
        for (String path : classDirectories.split(java.util.regex.Pattern.quote(File.pathSeparator))) {
            File root = new File(path);
            if (!root.exists()) continue;
            if (root.isFile()) {
                addEnumClass(root.toPath(), enumClassNames, singleEntryEnumClassNames);
                continue;
            }
            try (var paths = Files.walk(root.toPath())) {
                for (var classFile : paths.filter(Files::isRegularFile)
                        .filter(file -> file.toString().endsWith(".class")).toList()) {
                    String name = classFile.getFileName().toString();
                    if (name.equals("R.class") || name.startsWith("R$") || name.equals("BuildConfig.class")) {
                        continue;
                    }
                    addEnumClass(classFile, enumClassNames, singleEntryEnumClassNames);
                }
            }
        }
        return new EnumClassIndex(Set.copyOf(enumClassNames), Set.copyOf(singleEntryEnumClassNames));
    }

    private static void addEnumClass(java.nio.file.Path classFile, Set<String> enumClassNames,
            Set<String> singleEntryEnumClassNames) throws IOException {
        String fileName = classFile.getFileName().toString();
        if (!fileName.endsWith(".class") || fileName.equals("R.class") || fileName.startsWith("R$")
                || fileName.equals("BuildConfig.class")) return;
        ClassNode classNode = new ClassNode(Opcodes.ASM9);
        new ClassReader(Files.readAllBytes(classFile)).accept(classNode,
                ClassReader.SKIP_CODE | ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);
        if ((classNode.access & Opcodes.ACC_ENUM) != 0) {
            enumClassNames.add(classNode.name);
            long enumConstants = classNode.fields.stream()
                    .filter(field -> (field.access & Opcodes.ACC_ENUM) != 0)
                    .count();
            if (enumConstants == 1) singleEntryEnumClassNames.add(classNode.name);
        }
    }

    private record EnumClassIndex(Set<String> names, Set<String> singleEntryNames) {}

    private static void writeReport(File destination, SessionInfoStore sessions,
            ExecutionDataStore executionData, CoverageBuilder coverage, File sourceDirectory) throws IOException {
        final XMLFormatter formatter = new XMLFormatter();
        try (var output = Files.newOutputStream(destination.toPath())) {
            final var visitor = formatter.createVisitor(output);
            visitor.visitInfo(sessions.getInfos(), executionData.getContents());
            visitor.visitBundle(coverage.getBundle("app"),
                    new DirectorySourceFileLocator(sourceDirectory, "UTF-8", 4));
            visitor.visitEnd();
        }
    }

    private static int[] branchCounters(File report) throws Exception {
        final DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        final Document document = factory.newDocumentBuilder().parse(report);
        final NodeList counters = (NodeList) XPathFactory.newInstance().newXPath()
                .evaluate("/report/counter[@type='BRANCH']", document, XPathConstants.NODESET);
        if (counters.getLength() != 1) throw new IOException("Expected one aggregate BRANCH counter in " + report);
        var counter = counters.item(0).getAttributes();
        return new int[] { Integer.parseInt(counter.getNamedItem("missed").getNodeValue()),
                Integer.parseInt(counter.getNamedItem("covered").getNodeValue()) };
    }

    private static void writeAudit(File destination, List<String> entries) throws IOException {
        if (destination.toPath().getParent() != null) {
            Files.createDirectories(destination.toPath().getParent());
        }
        try (BufferedWriter writer = Files.newBufferedWriter(destination.toPath(), StandardCharsets.UTF_8)) {
            writer.write("JaCoCo filtered-bytecode audit (only instructions structurally proven generated)");
            writer.newLine();
            for (String entry : entries) {
                writer.write(entry);
                writer.newLine();
            }
        }
    }
}
