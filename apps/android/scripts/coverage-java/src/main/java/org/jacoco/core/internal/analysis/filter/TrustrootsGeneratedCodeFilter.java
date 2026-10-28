package org.jacoco.core.internal.analysis.filter;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.AnnotationNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.FrameNode;
import org.objectweb.asm.tree.LdcInsnNode;
import org.objectweb.asm.tree.LabelNode;
import org.objectweb.asm.tree.LineNumberNode;
import org.objectweb.asm.tree.LookupSwitchInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.TableSwitchInsnNode;
import org.objectweb.asm.tree.TypeInsnNode;

/**
 * Narrow filter for Kotlin/Compose bytecode that has no source behaviour.
 *
 * <p>The filter only removes (1) the exact Compose scaffolding plus exception
 * construction in a composable exhaustive-switch default arm, (2) a
 * source-line-only Compose group-close call, (3) an implicit coroutine
 * {@code Unit} return on a source-only closing-delimiter line after a
 * specifically recognised Compose coroutine API, and (4) a
 * branch-free forwarding method in a Kotlin callable-reference subclass.
 * It never ignores a branch instruction.</p>
 */
public final class TrustrootsGeneratedCodeFilter implements IFilter {

    private static final String COMPOSABLE_DESC = "Landroidx/compose/runtime/Composable;";
    private static final String COMPOSER = "androidx/compose/runtime/Composer";
    private static final String NO_WHEN = "kotlin/NoWhenBranchMatchedException";
    private static final String FUNCTION_REFERENCE = "kotlin/jvm/internal/FunctionReferenceImpl";
    private static final String ADAPTED_FUNCTION_REFERENCE = "kotlin/jvm/internal/AdaptedFunctionReference";
    private static final String SUSPEND_LAMBDA = "kotlin/coroutines/jvm/internal/SuspendLambda";
    private static final String RESTRICTED_SUSPEND_LAMBDA = "kotlin/coroutines/jvm/internal/RestrictedSuspendLambda";
    private static final String SNAPSHOT_STATE_KT = "androidx/compose/runtime/SnapshotStateKt";
    private static final String FLOW = "kotlinx/coroutines/flow/Flow";
    private static final String TRANSFORM_GESTURE_DETECTOR_KT =
            "androidx/compose/foundation/gestures/TransformGestureDetectorKt";
    private static final String POINTER_INPUT_SCOPE = "androidx/compose/ui/input/pointer/PointerInputScope";
    private static final List<String> AUDIT = Collections.synchronizedList(new ArrayList<>());

    public static List<String> auditEntries() {
        synchronized (AUDIT) {
            return new ArrayList<>(AUDIT);
        }
    }

    public static void clearAudit() {
        AUDIT.clear();
    }

    @Override
    public void filter(final MethodNode method, final IFilterContext context,
            final IFilterOutput output) {
        if (isKotlin(context)) {
            final boolean composeMethod = isComposable(method)
                    || method.desc.contains("Landroidx/compose/runtime/Composer;");
            if (composeMethod) {
                filterSwitchFallbacks(method, context, output);
                filterLoneComposeGroupClosures(method, context, output);
            }
            filterImplicitCoroutineCompletion(method, context, output);
            filterFunctionReferenceForwarder(method, context, output);
        }
    }

    private static void filterFunctionReferenceForwarder(MethodNode method,
            IFilterContext context, IFilterOutput output) {
        if (!"invoke".equals(method.name)
                || !context.getClassName().contains("$")
                || !(FUNCTION_REFERENCE.equals(context.getSuperClassName())
                        || ADAPTED_FUNCTION_REFERENCE.equals(context.getSuperClassName()))) {
            return;
        }
        AbstractInsnNode first = null;
        AbstractInsnNode last = null;
        int delegateCalls = 0;
        for (AbstractInsnNode insn : method.instructions) {
            int opcode = insn.getOpcode();
            if (opcode < 0) continue;
            if (isBranch(opcode) || !isForwardingOpcode(insn)) return;
            if (first == null) first = insn;
            last = insn;
            if (insn instanceof MethodInsnNode call && !isBoxingCall(call)) delegateCalls++;
        }
        if (first != null && delegateCalls == 1) {
            output.ignore(first, last);
            audit(context, method, first, last, "branch-free Kotlin callable-reference forwarder");
        }
    }

    private static boolean isForwardingOpcode(AbstractInsnNode insn) {
        int opcode = insn.getOpcode();
        if (opcode == Opcodes.ALOAD || opcode == Opcodes.ILOAD || opcode == Opcodes.LLOAD
                || opcode == Opcodes.FLOAD || opcode == Opcodes.DLOAD
                || opcode == Opcodes.GETFIELD || opcode == Opcodes.CHECKCAST
                || opcode == Opcodes.ACONST_NULL || opcode == Opcodes.DUP || opcode == Opcodes.POP
                || opcode == Opcodes.SWAP || opcode == Opcodes.ARETURN || opcode == Opcodes.IRETURN
                || opcode == Opcodes.LRETURN || opcode == Opcodes.FRETURN || opcode == Opcodes.DRETURN
                || opcode == Opcodes.RETURN || (opcode >= Opcodes.ICONST_M1 && opcode <= Opcodes.ICONST_5)
                || opcode == Opcodes.BIPUSH || opcode == Opcodes.SIPUSH || opcode == Opcodes.LDC) {
            return true;
        }
        return insn instanceof MethodInsnNode;
    }

    private static boolean isBoxingCall(MethodInsnNode call) {
        if (!List.of("java/lang/Boolean", "java/lang/Byte", "java/lang/Character", "java/lang/Short",
                "java/lang/Integer", "java/lang/Long", "java/lang/Float", "java/lang/Double")
                .contains(call.owner)) {
            return false;
        }
        String name = call.name;
        return "valueOf".equals(name) || name.endsWith("Value");
    }

    private static boolean isBranch(int opcode) {
        return (opcode >= Opcodes.IFEQ && opcode <= Opcodes.JSR)
                || opcode == Opcodes.TABLESWITCH || opcode == Opcodes.LOOKUPSWITCH
                || opcode == Opcodes.IFNULL || opcode == Opcodes.IFNONNULL;
    }

    private static void filterSwitchFallbacks(final MethodNode method,
            final IFilterContext context, final IFilterOutput output) {
        for (AbstractInsnNode insn : method.instructions) {
            LabelNode defaultLabel = null;
            if (insn instanceof TableSwitchInsnNode table) {
                defaultLabel = table.dflt;
            } else if (insn instanceof LookupSwitchInsnNode lookup) {
                defaultLabel = lookup.dflt;
            }
            if (defaultLabel == null) {
                continue;
            }
            List<AbstractInsnNode> block = instructionsUntilThrow(defaultLabel);
            if (isComposeExhaustiveSwitchFallback(block)) {
                AbstractInsnNode first = block.get(0);
                AbstractInsnNode thrown = block.get(block.size() - 1);
                output.ignore(first, thrown);
                audit(context, method, first, thrown,
                        "composable switch default NoWhenBranchMatchedException");
            }
        }
    }

    private static void filterLoneComposeGroupClosures(final MethodNode method,
            final IFilterContext context, final IFilterOutput output) {
        boolean hasComposeGroupStart = false;
        boolean hasComposeGroupEnd = false;
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof MethodInsnNode call && COMPOSER.equals(call.owner)) {
                hasComposeGroupStart |= "startReplaceGroup".equals(call.name);
                hasComposeGroupEnd |= "endReplaceGroup".equals(call.name)
                        || "endRestartGroup".equals(call.name);
            }
        }
        if (!hasComposeGroupStart || !hasComposeGroupEnd) {
            return;
        }
        final Map<Integer, List<AbstractInsnNode>> executableByLine = new HashMap<>();
        int line = -1;
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof LineNumberNode lineNode) {
                line = lineNode.line;
            } else if (insn.getOpcode() >= 0) {
                if (line >= 0) {
                    executableByLine.computeIfAbsent(line, unused -> new ArrayList<>()).add(insn);
                }
            }
        }
        for (var lineInstructions : executableByLine.entrySet()) {
            List<AbstractInsnNode> insns = lineInstructions.getValue();
            if (insns.size() == 2 && insns.get(0).getOpcode() == Opcodes.ALOAD
                    && isEndReplaceGroup(insns.get(1))) {
                output.ignore(insns.get(0), insns.get(1));
                audit(context, method, insns.get(0), insns.get(1),
                        "generated ALOAD/endReplaceGroup cleanup pair");
            } else if (insns.size() == 1 && isEndReplaceGroup(insns.get(0))) {
                output.ignore(insns.get(0), insns.get(0));
                audit(context, method, insns.get(0), insns.get(0),
                        "generated endReplaceGroup cleanup call");
            }
        }
    }

    private static boolean isEndReplaceGroup(final AbstractInsnNode insn) {
        return insn instanceof MethodInsnNode call && insn.getOpcode() == Opcodes.INVOKEINTERFACE
                && COMPOSER.equals(call.owner) && "endReplaceGroup".equals(call.name)
                && "()V".equals(call.desc);
    }

    private static void filterImplicitCoroutineCompletion(final MethodNode method,
            final IFilterContext context, final IFilterOutput output) {
        if (!isKnownCompilerCompletionBody(method, context)) {
            return;
        }
        for (AbstractInsnNode insn : method.instructions) {
            if (insn.getOpcode() != Opcodes.ARETURN) continue;
            AbstractInsnNode unit = implicitUnitBeforeReturn(insn);
            boolean implicitUnit = unit instanceof FieldInsnNode field
                    && field.getOpcode() == Opcodes.GETSTATIC
                    && "kotlin/Unit".equals(field.owner) && "INSTANCE".equals(field.name)
                    && "Lkotlin/Unit;".equals(field.desc);
            int sourceLine = effectiveSourceLine(context, bytecodeLine(unit));
            int returnSourceLine = effectiveSourceLine(context, bytecodeLine(insn));
            int candidateLine = returnSourceLine;
            if (implicitUnit && sourceLine > 0
                    && returnSourceLine > 0
                    && generatedUnitReturnLineStart(method, context, candidateLine, unit, insn) != null
                    && isClosingDelimiterLine(context, candidateLine)) {
                AbstractInsnNode generatedStart = generatedUnitReturnLineStart(
                        method, context, candidateLine, unit, insn);
                output.ignore(generatedStart, insn);
                audit(context, method, generatedStart, insn,
                        "implicit compiler completion after a recognised Compose coroutine API");
            }
        }
    }

    private static AbstractInsnNode implicitUnitBeforeReturn(AbstractInsnNode returned) {
        AbstractInsnNode unit = previousOpcode(returned.getPrevious());
        while (unit != null) {
            if (unit instanceof FieldInsnNode field && field.getOpcode() == Opcodes.GETSTATIC
                    && "kotlin/Unit".equals(field.owner) && "INSTANCE".equals(field.name)
                    && "Lkotlin/Unit;".equals(field.desc)) {
                return onlyProbeStoresBetween(unit, returned) ? unit : null;
            }
            unit = previousOpcode(unit.getPrevious());
        }
        return null;
    }

    private static boolean onlyProbeStoresBetween(AbstractInsnNode from, AbstractInsnNode to) {
        List<AbstractInsnNode> between = new ArrayList<>();
        for (AbstractInsnNode insn = nextOpcode(from); insn != null && insn != to; insn = nextOpcode(insn)) {
            between.add(insn);
        }
        for (int index = 0; index < between.size(); index += 4) {
            if (!isJaCoCoProbeStore(between, index)) return false;
        }
        return between.size() % 4 == 0;
    }

    private static boolean isKnownCompilerCompletionBody(MethodNode method, IFilterContext context) {
        boolean suspendLambda = "invokeSuspend".equals(method.name)
                && (SUSPEND_LAMBDA.equals(context.getSuperClassName())
                        || RESTRICTED_SUSPEND_LAMBDA.equals(context.getSuperClassName()));
        if (suspendLambda && hasSnapshotFlowCollection(method)) return true;
        if (!"invoke".equals(method.name)) return false;
        return hasCall(method, TRANSFORM_GESTURE_DETECTOR_KT, "detectTransformGestures$default")
                || hasCall(method, TRANSFORM_GESTURE_DETECTOR_KT, "detectTransformGestures")
                || hasCall(method, POINTER_INPUT_SCOPE, "awaitPointerEventScope");
    }

    private static boolean hasSnapshotFlowCollection(MethodNode method) {
        return hasCall(method, SNAPSHOT_STATE_KT, "snapshotFlow")
                && hasCall(method, FLOW, "collect");
    }

    private static boolean hasCall(MethodNode method, String owner, String name) {
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof MethodInsnNode call && owner.equals(call.owner)
                    && name.equals(call.name)) return true;
        }
        return false;
    }

    private static AbstractInsnNode generatedUnitReturnLineStart(MethodNode method, IFilterContext context,
            int wantedSourceLine, AbstractInsnNode unit, AbstractInsnNode returned) {
        List<AbstractInsnNode> instructions = new ArrayList<>();
        int currentBytecodeLine = -1;
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof LineNumberNode lineNode) currentBytecodeLine = lineNode.line;
            else if (insn.getOpcode() >= 0
                    && effectiveSourceLine(context, currentBytecodeLine) == wantedSourceLine) {
                instructions.add(insn);
            }
        }
        if (instructions.isEmpty() || instructions.get(instructions.size() - 1) != returned) return null;
        int end = instructions.size() - 1;
        while (end >= 4 && isJaCoCoProbeStore(instructions, end - 4)) {
            end -= 4;
        }
        if (end > 0 && instructions.get(end - 1) == unit) end--;
        if (end > 0 && instructions.get(end - 1).getOpcode() == Opcodes.POP) end--;
        return end == 0 && (instructions.size() == 1 || instructions.contains(unit))
                ? instructions.get(0) : null;
    }

    private static boolean isJaCoCoProbeStore(List<AbstractInsnNode> instructions, int index) {
        if (index + 3 >= instructions.size()) return false;
        AbstractInsnNode array = instructions.get(index);
        AbstractInsnNode slot = instructions.get(index + 1);
        AbstractInsnNode value = instructions.get(index + 2);
        AbstractInsnNode store = instructions.get(index + 3);
        return (array.getOpcode() == Opcodes.ALOAD)
                && (slot.getOpcode() == Opcodes.ICONST_M1
                        || slot.getOpcode() >= Opcodes.ICONST_0 && slot.getOpcode() <= Opcodes.ICONST_5
                        || slot.getOpcode() == Opcodes.BIPUSH || slot.getOpcode() == Opcodes.SIPUSH)
                && value.getOpcode() == Opcodes.ICONST_1 && store.getOpcode() == Opcodes.BASTORE;
    }

    private static AbstractInsnNode nextOpcode(AbstractInsnNode insn) {
        for (AbstractInsnNode cursor = insn == null ? null : insn.getNext(); cursor != null;
                cursor = cursor.getNext()) {
            if (!(cursor instanceof LabelNode) && !(cursor instanceof FrameNode)
                    && !(cursor instanceof LineNumberNode) && cursor.getOpcode() >= 0) {
                return cursor;
            }
        }
        return null;
    }

    private static AbstractInsnNode previousOpcode(AbstractInsnNode insn) {
        for (AbstractInsnNode cursor = insn; cursor != null; cursor = cursor.getPrevious()) {
            if (!(cursor instanceof LabelNode) && !(cursor instanceof FrameNode)
                    && !(cursor instanceof LineNumberNode) && cursor.getOpcode() >= 0) {
                return cursor;
            }
        }
        return null;
    }

    private static int bytecodeLine(AbstractInsnNode insn) {
        for (AbstractInsnNode cursor = insn; cursor != null; cursor = cursor.getPrevious()) {
            if (cursor instanceof LineNumberNode lineNode) return lineNode.line;
        }
        return -1;
    }

    private static int effectiveSourceLine(IFilterContext context, int bytecodeLine) {
        if (bytecodeLine < 1 || context.getKotlinSMAP() == null) return bytecodeLine;
        int mapped = -1;
        for (KotlinSMAP.Mapping mapping : context.getKotlinSMAP().mappings()) {
            int mappingEnd = mapping.outputStartLine() + mapping.repeatCount() - 1;
            if (bytecodeLine >= mapping.outputStartLine() && bytecodeLine <= mappingEnd
                    && context.getClassName().equals(mapping.inputClassName())) {
                int candidate = mapping.inputStartLine() + bytecodeLine - mapping.outputStartLine();
                if (mapped != -1 && mapped != candidate) return -1;
                mapped = candidate;
            }
        }
        return mapped == -1 ? bytecodeLine : mapped;
    }

    private static boolean isClosingDelimiterLine(IFilterContext context, int line) {
        String root = System.getProperty("trustroots.coverage.sourceRoot");
        String sourceFile = context.getSourceFileName();
        if (root == null || sourceFile == null) return false;
        int separator = context.getClassName().lastIndexOf('/');
        String packagePath = separator < 0 ? "" : context.getClassName().substring(0, separator + 1);
        Path file = Path.of(root).resolve(packagePath + sourceFile).normalize();
        try {
            List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
            if (line > lines.size()) return false;
            String text = lines.get(line - 1).trim();
            return !text.isEmpty() && text.matches("[}\\]),]+\\s*");
        } catch (Exception ignored) {
            return false;
        }
    }

    private static List<AbstractInsnNode> instructionsUntilThrow(AbstractInsnNode label) {
        List<AbstractInsnNode> result = new ArrayList<>();
        for (AbstractInsnNode insn = label.getNext(); insn != null; insn = insn.getNext()) {
            if (insn.getOpcode() >= 0) {
                result.add(insn);
                if (insn.getOpcode() == Opcodes.ATHROW) break;
            } else if (insn instanceof LabelNode && !result.isEmpty()) {
                // The first label after the switch default starts another case block.
                break;
            }
        }
        return result;
    }

    private static boolean isComposeExhaustiveSwitchFallback(List<AbstractInsnNode> block) {
        if (block.size() != 9) return false;
        return block.get(0).getOpcode() == Opcodes.ALOAD
                && block.get(1) instanceof LdcInsnNode
                && isMethod(block.get(2), "startReplaceGroup", "(I)V")
                && block.get(3).getOpcode() == Opcodes.ALOAD
                && isMethod(block.get(4), "endReplaceGroup", "()V")
                && block.get(5) instanceof TypeInsnNode type && type.getOpcode() == Opcodes.NEW
                && NO_WHEN.equals(type.desc)
                && block.get(6).getOpcode() == Opcodes.DUP
                && block.get(7) instanceof MethodInsnNode ctor
                && ctor.getOpcode() == Opcodes.INVOKESPECIAL
                && NO_WHEN.equals(ctor.owner) && "<init>".equals(ctor.name) && "()V".equals(ctor.desc)
                && block.get(8).getOpcode() == Opcodes.ATHROW;
    }

    private static boolean isMethod(AbstractInsnNode insn, String name, String descriptor) {
        return insn instanceof MethodInsnNode call && insn.getOpcode() == Opcodes.INVOKEINTERFACE
                && COMPOSER.equals(call.owner) && name.equals(call.name) && descriptor.equals(call.desc);
    }

    private static boolean isComposable(final MethodNode method) {
        return hasAnnotation(method.visibleAnnotations) || hasAnnotation(method.invisibleAnnotations);
    }

    private static boolean hasAnnotation(final List<AnnotationNode> annotations) {
        if (annotations == null) {
            return false;
        }
        for (AnnotationNode annotation : annotations) {
            if (COMPOSABLE_DESC.equals(annotation.desc)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isKotlin(final IFilterContext context) {
        return context.getClassAnnotations().contains(Filters.KOTLIN_METADATA_DESC);
    }

    private static void audit(final IFilterContext context, final MethodNode method,
            final AbstractInsnNode from, final AbstractInsnNode to, final String reason) {
        int line = effectiveSourceLine(context, bytecodeLine(from));
        StringBuilder signature = new StringBuilder();
        for (AbstractInsnNode insn = from; insn != null; insn = insn.getNext()) {
            if (insn.getOpcode() >= 0) {
                if (signature.length() > 0) signature.append("; ");
                signature.append(instructionLabel(insn));
            }
            if (insn == to) break;
        }
        AUDIT.add(context.getClassName() + "." + method.name + method.desc + ":" + line + " " + reason
                + " [" + signature + "]");
    }

    private static String instructionLabel(AbstractInsnNode insn) {
        if (insn instanceof MethodInsnNode call) {
            return insn.getOpcode() + " " + call.owner + "." + call.name + call.desc;
        }
        if (insn instanceof FieldInsnNode field) {
            return insn.getOpcode() + " " + field.owner + "." + field.name + ":" + field.desc;
        }
        if (insn instanceof TypeInsnNode type) {
            return insn.getOpcode() + " " + type.desc;
        }
        return Integer.toString(insn.getOpcode());
    }
}
