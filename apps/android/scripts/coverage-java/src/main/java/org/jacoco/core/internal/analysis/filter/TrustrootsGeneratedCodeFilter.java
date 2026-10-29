package org.jacoco.core.internal.analysis.filter;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.AnnotationNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.FrameNode;
import org.objectweb.asm.tree.JumpInsnNode;
import org.objectweb.asm.tree.LdcInsnNode;
import org.objectweb.asm.tree.LabelNode;
import org.objectweb.asm.tree.LineNumberNode;
import org.objectweb.asm.tree.LookupSwitchInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.LocalVariableNode;
import org.objectweb.asm.tree.VarInsnNode;
import org.objectweb.asm.tree.TableSwitchInsnNode;
import org.objectweb.asm.tree.TypeInsnNode;

/**
 * Narrow filter for Kotlin/Compose bytecode that has no source behaviour.
 *
 * <p>The filter only removes (1) the exact Compose scaffolding plus exception
 * construction in a composable exhaustive-switch default arm, (2) a
 * source-line-only Compose group-close call, (3) an implicit coroutine
 * {@code Unit} return on a source-only closing-delimiter line after a
 * specifically recognised Compose coroutine API, (4) the single default
 * outcome of an exact Kotlin enum-mapping switch whose default target is the
 * generated Compose exhaustive-switch exception block, (5) a branch-free
 * forwarding method in a Kotlin callable-reference subclass, and (6)
 * individual captured-state cache invalidation branches only when they form a
 * compiler mask expression inside a Compose remember marker and feed its
 * remembered-value cache gate, and (7) hidden default-mask tests whose
 * branch-free default assignment targets the corresponding source parameter.</p>
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
    private static final String CAPTURED_REMEMBER_REASON = "captured-state Compose remember cache mask decision";
    private static final String COMPOSABLE_DEFAULT_REASON = "composable default-argument dispatch decision";
    private static final List<String> AUDIT = Collections.synchronizedList(new ArrayList<>());
    private static volatile Set<String> ENUM_CLASSES = Set.of();

    public static void setEnumClassNames(Set<String> enumClassNames) {
        ENUM_CLASSES = Set.copyOf(enumClassNames);
    }

    public static List<String> auditEntries() {
        synchronized (AUDIT) {
            return new ArrayList<>(AUDIT);
        }
    }

    public static void clearAudit() {
        AUDIT.clear();
    }

    public static int filteredBranchDecisionCount() {
        synchronized (AUDIT) {
            return (int) AUDIT.stream()
                    .filter(entry -> entry.contains("captured-state Compose remember cache mask decision")
                            || entry.contains("Compose default-argument invalidation decision")
                            || entry.contains(COMPOSABLE_DEFAULT_REASON))
                    .count();
        }
    }

    public static int filteredBranchOutcomeCount() {
        synchronized (AUDIT) {
            return (int) AUDIT.stream()
                    .filter(entry -> entry.contains("captured-state Compose remember cache mask decision")
                            || entry.contains("Compose default-argument invalidation decision")
                            || entry.contains(COMPOSABLE_DEFAULT_REASON))
                    .count() * 2
                    + (int) AUDIT.stream()
                            .filter(entry -> entry.contains("exhaustive Compose enum switch default outcome"))
                            .count();
        }
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
                filterRememberCacheMaskBranches(method, context, output);
                filterComposableDefaultInvalidationBranches(method, context, output);
                filterComposableDefaultDispatch(method, context, output);
            }
            filterImplicitCoroutineCompletion(method, context, output);
            filterFunctionReferenceForwarder(method, context, output);
        }
    }

    /** Removes a hidden default-mask test only when its fallthrough computes that parameter's default. */
    private static void filterComposableDefaultDispatch(MethodNode method,
            IFilterContext context, IFilterOutput output) {
        if (!isComposable(method)) return;
        HiddenComposerParameters parameters = hiddenComposerParameters(method);
        if (parameters == null || parameters.defaultMaskSlots().size() != 1
                || parameters.hiddenIntCount() != 2 || parameters.sourceArgumentCount() > 10) return;
        List<AbstractInsnNode> insns = new ArrayList<>();
        for (AbstractInsnNode insn : method.instructions) insns.add(insn);
        int shouldExecute = -1;
        for (int i = 0; i < insns.size(); i++) {
            if (isComposerCall(insns.get(i), "shouldExecute", "(ZI)Z")) {
                shouldExecute = i;
                break;
            }
        }
        if (shouldExecute < 0) return;
        for (int i = shouldExecute + 1; i < insns.size(); i++) {
            AbstractInsnNode insn = insns.get(i);
            if (!(insn instanceof JumpInsnNode jump) || isAlreadyFilteredBranch(output, insn)) continue;
            if (!isDefaultMaskDispatch(insns, i, jump, parameters)) continue;
            output.ignore(insn, insn);
            audit(context, method, insn, insn, COMPOSABLE_DEFAULT_REASON);
        }
    }

    private static boolean isDefaultMaskDispatch(List<AbstractInsnNode> insns, int branchIndex,
            JumpInsnNode branch, HiddenComposerParameters parameters) {
        if (branch.getOpcode() != Opcodes.IFEQ) return false;
        AbstractInsnNode and = previousOpcode(branch.getPrevious());
        AbstractInsnNode bitNode = previousOpcode(and == null ? null : and.getPrevious());
        AbstractInsnNode load = previousOpcode(bitNode == null ? null : bitNode.getPrevious());
        if (and == null || and.getOpcode() != Opcodes.IAND
                || !(load instanceof VarInsnNode variable) || variable.getOpcode() != Opcodes.ILOAD) return false;
        Integer bit = integerConstantValue(bitNode);
        if (bit == null || bit <= 0 || (bit & (bit - 1)) != 0) return false;
        int parameterIndex = Integer.numberOfTrailingZeros(bit);
        int maskIndex = parameterIndex / 32;
        if (maskIndex >= parameters.defaultMaskSlots().size()
                || variable.var != parameters.defaultMaskSlots().get(maskIndex)
                || parameterIndex >= parameters.sourceArgumentCount()) return false;
        int expectedBit = 1 << (parameterIndex % 32);
        if (bit != expectedBit) return false;
        int targetSlot = parameters.sourceArgumentSlots().get(parameterIndex);
        int expectedStore = storeOpcode(parameters.sourceArgumentTypes().get(parameterIndex));
        int stores = 0;
        AbstractInsnNode lastOpcode = null;
        boolean foundTarget = false;
        for (AbstractInsnNode cursor = branch.getNext(); cursor != null; cursor = cursor.getNext()) {
            if (cursor == branch.label) {
                foundTarget = true;
                break;
            }
            if (cursor.getOpcode() < 0) continue;
            if (cursor instanceof JumpInsnNode || cursor instanceof TableSwitchInsnNode
                    || cursor instanceof LookupSwitchInsnNode) return false;
            if (cursor instanceof VarInsnNode store && isStoreOpcode(store.getOpcode())) {
                if (store.var != targetSlot || store.getOpcode() != expectedStore) return false;
                stores++;
            }
            lastOpcode = cursor;
        }
        return foundTarget && stores == 1 && lastOpcode instanceof VarInsnNode store
                && store.var == targetSlot && store.getOpcode() == expectedStore;
    }

    private static boolean isStoreOpcode(int opcode) {
        return opcode == Opcodes.ISTORE || opcode == Opcodes.LSTORE || opcode == Opcodes.FSTORE
                || opcode == Opcodes.DSTORE || opcode == Opcodes.ASTORE;
    }

    private static int storeOpcode(Type type) {
        return switch (type.getSort()) {
            case Type.BOOLEAN, Type.BYTE, Type.CHAR, Type.SHORT, Type.INT -> Opcodes.ISTORE;
            case Type.LONG -> Opcodes.LSTORE;
            case Type.FLOAT -> Opcodes.FSTORE;
            case Type.DOUBLE -> Opcodes.DSTORE;
            case Type.ARRAY, Type.OBJECT -> Opcodes.ASTORE;
            default -> -1;
        };
    }

    private static HiddenComposerParameters hiddenComposerParameters(MethodNode method) {
        if (method.localVariables == null || method.localVariables.isEmpty()) return null;
        Type[] arguments = Type.getArgumentTypes(method.desc);
        List<Type> sourceTypes = new ArrayList<>();
        List<Integer> sourceSlots = new ArrayList<>();
        int slot = (method.access & Opcodes.ACC_STATIC) == 0 ? 1 : 0;
        int composerSlot = -1;
        int changedSlot = -1;
        List<Integer> defaultMaskSlots = new ArrayList<>();
        boolean afterComposer = false;
        for (Type argument : arguments) {
            if (!afterComposer) {
                if (argument.getSort() == Type.OBJECT && COMPOSER.equals(argument.getInternalName())) {
                    composerSlot = slot;
                    afterComposer = true;
                } else {
                    sourceTypes.add(argument);
                    sourceSlots.add(slot);
                }
            } else {
                if (argument.getSort() != Type.INT) return null;
                if (changedSlot < 0) changedSlot = slot;
                else defaultMaskSlots.add(slot);
            }
            slot += argument.getSize();
        }
        if (composerSlot < 0 || changedSlot < 0) return null;
        final int maskSlot = changedSlot;
        boolean hasChangedName = method.localVariables.stream().anyMatch(local -> local.index == maskSlot
                && local.name.startsWith("$changed")
                && "I".equals(local.desc));
        if (!hasChangedName) return null;
        if (defaultMaskSlots.stream().anyMatch(defaultSlot -> method.localVariables.stream()
                .anyMatch(local -> local.index == defaultSlot && local.name.startsWith("$changed")))) return null;
        return new HiddenComposerParameters(arguments.length - sourceTypes.size() - 1,
                List.copyOf(defaultMaskSlots),
                List.copyOf(sourceTypes), List.copyOf(sourceSlots));
    }

    private record HiddenComposerParameters(int hiddenIntCount, List<Integer> defaultMaskSlots,
            List<Type> sourceArgumentTypes, List<Integer> sourceArgumentSlots) {
        int sourceArgumentCount() { return sourceArgumentTypes.size(); }
    }

    private static void filterComposableDefaultInvalidationBranches(MethodNode method,
            IFilterContext context, IFilterOutput output) {
        if (method.localVariables == null) return;
        DefaultArgumentSlots argumentSlots = defaultArgumentSlots(method);
        if (argumentSlots == null || argumentSlots.defaultMasks().isEmpty()) return;
        List<AbstractInsnNode> insns = new ArrayList<>();
        for (AbstractInsnNode insn : method.instructions) insns.add(insn);
        for (int index = 0; index < insns.size(); index++) {
            if (!isComposerCall(insns.get(index), "startDefaults", "()V")) continue;
            int end = findComposerCall(insns, index + 1, "endDefaults", "()V");
            if (end < 0) continue;
            boolean hasDefaultsInvalid = false;
            boolean hasSkipToGroupEnd = false;
            for (int cursor = index + 1; cursor < end; cursor++) {
                hasDefaultsInvalid |= isComposerCall(insns.get(cursor), "getDefaultsInvalid", "()Z");
                hasSkipToGroupEnd |= isComposerCall(insns.get(cursor), "skipToGroupEnd", "()V");
            }
            if (!hasDefaultsInvalid || !hasSkipToGroupEnd) continue;
            for (int cursor = index + 1; cursor < end; cursor++) {
                AbstractInsnNode insn = insns.get(cursor);
                if (!(insn instanceof org.objectweb.asm.tree.JumpInsnNode)
                        || isAlreadyFilteredBranch(output, insn)
                        || !isDefaultMaskDecision(insns, cursor, argumentSlots)) continue;
                output.ignore(insn, insn);
                audit(context, method, insn, insn,
                        "Compose default-argument invalidation decision");
            }
            for (int cursor = index + 1; cursor < end; cursor++) {
                AbstractInsnNode insn = insns.get(cursor);
                if (!(insn instanceof org.objectweb.asm.tree.JumpInsnNode)
                        || isAlreadyFilteredBranch(output, insn)
                        || (insn.getOpcode() != Opcodes.IFEQ && insn.getOpcode() != Opcodes.IFNE)) continue;
                AbstractInsnNode previous = previousOpcode(insn.getPrevious());
                if (previous instanceof MethodInsnNode call && COMPOSER.equals(call.owner)
                        && "getDefaultsInvalid".equals(call.name) && "()Z".equals(call.desc)) {
                    output.ignore(insn, insn);
                    audit(context, method, insn, insn,
                            "Compose default-argument invalidation decision");
                }
            }
        }
    }

    private static DefaultArgumentSlots defaultArgumentSlots(MethodNode method) {
        Type[] arguments = Type.getArgumentTypes(method.desc);
        int slot = (method.access & Opcodes.ACC_STATIC) == 0 ? 1 : 0;
        boolean foundComposer = false;
        int changedSlot = -1;
        List<Integer> defaultMasks = new ArrayList<>();
        for (Type argument : arguments) {
            if (!foundComposer) {
                if (argument.getSort() == Type.OBJECT && COMPOSER.equals(argument.getInternalName())) {
                    foundComposer = true;
                }
            } else {
                if (argument.getSort() != Type.INT) return null;
                if (changedSlot < 0) {
                    int parameterSlot = slot;
                    boolean hasChangedName = method.localVariables.stream().anyMatch(local ->
                            local.index == parameterSlot && local.name.startsWith("$changed"));
                    if (!hasChangedName) return null;
                    changedSlot = slot;
                } else {
                    defaultMasks.add(slot);
                }
            }
            slot += argument.getSize();
        }
        return changedSlot < 0 ? null : new DefaultArgumentSlots(changedSlot, List.copyOf(defaultMasks));
    }

    private static int findComposerCall(List<AbstractInsnNode> insns, int start,
            String name, String descriptor) {
        for (int index = start; index < insns.size(); index++) {
            if (isComposerCall(insns.get(index), name, descriptor)) return index;
            if (isComposerCall(insns.get(index), "startDefaults", "()V")) return -1;
        }
        return -1;
    }

    private static boolean isComposerCall(AbstractInsnNode insn, String name, String descriptor) {
        return insn instanceof MethodInsnNode call && COMPOSER.equals(call.owner)
                && name.equals(call.name) && descriptor.equals(call.desc);
    }

    private static boolean isDefaultMaskDecision(List<AbstractInsnNode> insns, int branchIndex,
            DefaultArgumentSlots argumentSlots) {
        AbstractInsnNode branch = insns.get(branchIndex);
        if (branch.getOpcode() != Opcodes.IFEQ && branch.getOpcode() != Opcodes.IFNE) return false;
        AbstractInsnNode and = previousOpcode(branch.getPrevious());
        AbstractInsnNode bit = previousOpcode(and == null ? null : and.getPrevious());
        AbstractInsnNode load = previousOpcode(bit == null ? null : bit.getPrevious());
        if (and == null || and.getOpcode() != Opcodes.IAND || !isIntegerConstant(bit)
                || !(load instanceof VarInsnNode variableLoad) || variableLoad.getOpcode() != Opcodes.ILOAD) return false;
        Integer maskBit = integerConstantValue(bit);
        if (maskBit == null || maskBit <= 0 || (maskBit & (maskBit - 1)) != 0) return false;
        return argumentSlots.defaultMasks().contains(variableLoad.var)
                || variableLoad.var == argumentSlots.changedMask() && maskBit == 1;
    }

    private record DefaultArgumentSlots(int changedMask, List<Integer> defaultMasks) {}

    private static Integer integerConstantValue(AbstractInsnNode insn) {
        int opcode = insn.getOpcode();
        if (opcode == Opcodes.ICONST_M1) return -1;
        if (opcode >= Opcodes.ICONST_0 && opcode <= Opcodes.ICONST_5) return opcode - Opcodes.ICONST_0;
        if (insn instanceof org.objectweb.asm.tree.IntInsnNode intInsn) return intInsn.operand;
        if (insn instanceof LdcInsnNode ldc && ldc.cst instanceof Integer value) return value;
        return null;
    }

    private static void filterRememberCacheMaskBranches(MethodNode method,
            IFilterContext context, IFilterOutput output) {
        List<AbstractInsnNode> all = new ArrayList<>();
        for (AbstractInsnNode insn : method.instructions) all.add(insn);
        for (int marker = 0; marker < all.size(); marker++) {
            if (!(all.get(marker) instanceof LdcInsnNode ldc)
                    || !(ldc.cst instanceof String text) || !text.contains("CC(remember):")) continue;
            int markerStart = findMarkerCall(all, marker + 1, "sourceInformationMarkerStart",
                    "(Landroidx/compose/runtime/Composer;ILjava/lang/String;)V");
            if (markerStart < 0) continue;
            int markerEnd = findMarkerCall(all, markerStart + 1, "sourceInformationMarkerEnd",
                    "(Landroidx/compose/runtime/Composer;)V");
            if (markerEnd < 0) continue;
            int remembered = findCall(all, markerStart + 1, COMPOSER, "rememberedValue", "()Ljava/lang/Object;");
            if (remembered < 0 || remembered >= markerEnd || !hasRememberCacheGate(all, remembered, markerEnd)) continue;
            List<AbstractInsnNode> region = all.subList(markerStart + 1, remembered);
            if (!isCompilerChangedMaskRegion(region)) continue;
            if (!usesCompilerMaskLocals(method, region)) continue;
            int composerChangedCalls = 0;
            for (AbstractInsnNode insn : region) {
                if (insn instanceof MethodInsnNode call && COMPOSER.equals(call.owner)
                        && isComposerChangedCall(call)) composerChangedCalls++;
            }
            if (composerChangedCalls == 0) continue;
            for (AbstractInsnNode insn : region) {
                if (insn instanceof org.objectweb.asm.tree.JumpInsnNode
                        && !isAlreadyFilteredBranch(output, insn)
                        && isConditionalDecision(insn.getOpcode())
                        && isMaskOrChangedStateDecision(region, insn)) {
                    output.ignore(insn, insn);
                    audit(context, method, insn, insn,
                            "captured-state Compose remember cache mask decision");
                }
            }
        }
    }

    private static boolean isConditionalDecision(int opcode) {
        return opcode >= Opcodes.IFEQ && opcode <= Opcodes.IF_ACMPNE
                || opcode == Opcodes.IFNULL || opcode == Opcodes.IFNONNULL;
    }

    private static boolean isAlreadyFilteredBranch(IFilterOutput output, AbstractInsnNode insn) {
        return output instanceof TrackingFilterOutput tracking && tracking.isBranchAlreadyFiltered(insn);
    }

    private static int findCall(List<AbstractInsnNode> insns, int start,
            String owner, String name, String descriptor) {
        for (int i = start; i < insns.size(); i++) {
            if (insns.get(i) instanceof MethodInsnNode call && owner.equals(call.owner)
                    && name.equals(call.name) && descriptor.equals(call.desc)) return i;
        }
        return -1;
    }

    private static int findMarkerCall(List<AbstractInsnNode> insns, int start,
            String name, String descriptor) {
        for (int i = start; i < insns.size(); i++) {
            if (!(insns.get(i) instanceof MethodInsnNode call)
                    || !"androidx/compose/runtime/ComposerKt".equals(call.owner)) continue;
            if (name.equals(call.name) && descriptor.equals(call.desc)) return i;
            if ("sourceInformationMarkerStart".equals(call.name)
                    || "sourceInformationMarkerEnd".equals(call.name)) return -1;
        }
        return -1;
    }

    private static boolean hasRememberCacheGate(List<AbstractInsnNode> insns, int remembered, int markerEnd) {
        int end = Math.min(markerEnd, remembered + 22);
        boolean sawEmpty = false;
        for (int i = remembered + 1; i < end; i++) {
            AbstractInsnNode insn = insns.get(i);
            if (insn instanceof MethodInsnNode call && "getEmpty".equals(call.name)
                    && "androidx/compose/runtime/Composer$Companion".equals(call.owner)) sawEmpty = true;
            if (sawEmpty && insn.getOpcode() == Opcodes.IF_ACMPNE) return true;
        }
        return false;
    }

    private static boolean isCompilerChangedMaskRegion(List<AbstractInsnNode> region) {
        int ands = 0;
        int changedCalls = 0;
        int stores = 0;
        int conditionals = 0;
        for (int index = 0; index < region.size(); index++) {
            AbstractInsnNode insn = region.get(index);
            int opcode = insn.getOpcode();
            if (opcode < 0) continue;
            if (opcode == Opcodes.IAND) ands++;
            else if (opcode == Opcodes.ISTORE) stores++;
            else if (insn instanceof org.objectweb.asm.tree.JumpInsnNode) conditionals++;
            else if (insn instanceof MethodInsnNode call) {
                if (COMPOSER.equals(call.owner) && isComposerChangedCall(call)) changedCalls++;
                else if (!"sourceInformationMarkerStart".equals(call.name)
                        && !isEnumOrdinalCapturePart(region, index)) return false;
            } else if (insn instanceof TypeInsnNode && isEnumOrdinalCapturePart(region, index)) {
                // Compose represents a stable enum capture as enum.ordinal() passed directly to changed(int).
            } else if (!isMaskOpcode(insn)) return false;
        }
        return ands >= 2 && changedCalls >= 1 && stores >= 1 && conditionals >= 2;
    }

    /**
     * Recognises only the compiler's enum-key encoding when ordinal() directly
     * supplies Composer.changed(int). An ordinal used by an application
     * condition or any other call sequence does not satisfy this pattern.
     */
    private static boolean isEnumOrdinalCapturePart(List<AbstractInsnNode> region, int index) {
        AbstractInsnNode insn = region.get(index);
        AbstractInsnNode cast = insn instanceof TypeInsnNode typeInsn
                && typeInsn.getOpcode() == Opcodes.CHECKCAST
                ? insn
                : previousOpcode(insn.getPrevious());
        if (!(cast instanceof TypeInsnNode typeInsn)
                || typeInsn.getOpcode() != Opcodes.CHECKCAST || !"java/lang/Enum".equals(typeInsn.desc)) {
            return false;
        }
        AbstractInsnNode ordinal = nextOpcode(cast);
        AbstractInsnNode changed = ordinal == null ? null : nextOpcode(ordinal);
        return ordinal instanceof MethodInsnNode ordinalCall
                && ordinalCall.getOpcode() == Opcodes.INVOKEVIRTUAL
                && "java/lang/Enum".equals(ordinalCall.owner)
                && "ordinal".equals(ordinalCall.name) && "()I".equals(ordinalCall.desc)
                && changed instanceof MethodInsnNode changedCall
                && changedCall.getOpcode() == Opcodes.INVOKEINTERFACE
                && COMPOSER.equals(changedCall.owner)
                && "changed".equals(changedCall.name) && "(I)Z".equals(changedCall.desc);
    }

    private static boolean isComposerChangedCall(MethodInsnNode call) {
        return ("changedInstance".equals(call.name) || "changed".equals(call.name))
                && call.desc.endsWith(")Z");
    }

    private static boolean usesCompilerMaskLocals(MethodNode method, List<AbstractInsnNode> region) {
        if (method.localVariables == null || method.localVariables.isEmpty()) return false;
        Set<Integer> compilerMaskSlots = compilerMaskParameterSlots(method);
        if (compilerMaskSlots.isEmpty()) return false;
        compilerMaskSlots.addAll(compilerDerivedDirtySlots(method, compilerMaskSlots));
        int verifiedMaskLoads = 0;
        for (int index = 0; index < region.size(); index++) {
            AbstractInsnNode insn = region.get(index);
            if (!(insn instanceof VarInsnNode load) || load.getOpcode() != Opcodes.ILOAD) continue;
            AbstractInsnNode next = nextOpcode(insn);
            if (next == null || !isIntegerConstant(next)) continue;
            AbstractInsnNode afterConstant = nextOpcode(next);
            if (afterConstant == null || afterConstant.getOpcode() != Opcodes.IAND) continue;
            if (!compilerMaskSlots.contains(load.var)) return false;
            verifiedMaskLoads++;
        }
        return verifiedMaskLoads > 0;
    }

    private static Set<Integer> compilerMaskParameterSlots(MethodNode method) {
        Set<Integer> result = new java.util.HashSet<>();
        int slot = (method.access & Opcodes.ACC_STATIC) == 0 ? 1 : 0;
        boolean afterComposer = false;
        for (Type argument : Type.getArgumentTypes(method.desc)) {
            if (afterComposer) {
                if (argument.getSort() != Type.INT) return Set.of();
                int parameterSlot = slot;
                for (LocalVariableNode local : method.localVariables) {
                    if (local.index == parameterSlot && (local.name.startsWith("$changed")
                            || local.name.startsWith("$dirty"))) result.add(parameterSlot);
                }
            }
            if (argument.getSort() == Type.OBJECT && COMPOSER.equals(argument.getInternalName())) {
                afterComposer = true;
            }
            slot += argument.getSize();
        }
        return result;
    }

    private static Set<Integer> compilerDerivedDirtySlots(MethodNode method, Set<Integer> maskSlots) {
        Set<Integer> result = new java.util.HashSet<>();
        if (method.localVariables == null) return result;
        for (LocalVariableNode local : method.localVariables) {
            if (!local.name.startsWith("$dirty") || maskSlots.contains(local.index)) continue;
            for (AbstractInsnNode insn : method.instructions) {
                if (!(insn instanceof VarInsnNode store) || store.getOpcode() != Opcodes.ISTORE
                        || store.var != local.index) continue;
                AbstractInsnNode cursor = previousOpcode(insn.getPrevious());
                if (cursor instanceof VarInsnNode directCopy && directCopy.getOpcode() == Opcodes.ILOAD
                        && maskSlots.contains(directCopy.var)) {
                    result.add(local.index);
                    continue;
                }
                boolean usedMask = false;
                boolean hadMaskOperation = false;
                int budget = 20;
                while (cursor != null && budget-- > 0) {
                    if (cursor instanceof MethodInsnNode || cursor.getOpcode() == Opcodes.GETFIELD
                            || cursor.getOpcode() == Opcodes.GETSTATIC) break;
                    if (cursor instanceof VarInsnNode load && load.getOpcode() == Opcodes.ILOAD
                            && maskSlots.contains(load.var)) usedMask = true;
                    if (cursor.getOpcode() == Opcodes.IAND) hadMaskOperation = true;
                    if (usedMask && hadMaskOperation) break;
                    cursor = previousOpcode(cursor.getPrevious());
                }
                if (usedMask && hadMaskOperation) result.add(local.index);
            }
        }
        return result;
    }

    private static boolean isMaskOpcode(AbstractInsnNode insn) {
        int opcode = insn.getOpcode();
        return opcode == Opcodes.ALOAD || opcode == Opcodes.ILOAD || opcode == Opcodes.ISTORE
                || opcode == Opcodes.ASTORE || opcode == Opcodes.ICONST_M1
                || opcode >= Opcodes.ICONST_0 && opcode <= Opcodes.ICONST_5
                || opcode == Opcodes.BIPUSH || opcode == Opcodes.SIPUSH
                || opcode == Opcodes.LDC && insn instanceof LdcInsnNode ldc && ldc.cst instanceof Integer
                || opcode == Opcodes.IAND || opcode == Opcodes.IOR || opcode == Opcodes.IXOR
                || opcode == Opcodes.IFEQ || opcode == Opcodes.IFNE
                || opcode >= Opcodes.IF_ICMPEQ && opcode <= Opcodes.IF_ICMPLE
                || opcode == Opcodes.GOTO || opcode == Opcodes.NOP;
    }

    private static boolean isMaskOrChangedStateDecision(List<AbstractInsnNode> region,
            AbstractInsnNode decision) {
        AbstractInsnNode previous = previousOpcode(decision.getPrevious());
        if (previous == null) return false;
        if (decision.getOpcode() >= Opcodes.IF_ICMPEQ && decision.getOpcode() <= Opcodes.IF_ICMPLE) {
            if (!isIntegerConstant(previous)) return false;
            AbstractInsnNode beforeConstant = previousOpcode(previous.getPrevious());
            if (beforeConstant != null && beforeConstant.getOpcode() == Opcodes.IAND) return true;
            if (beforeConstant == null || beforeConstant.getOpcode() != Opcodes.IXOR) return false;
            AbstractInsnNode xorMask = previousOpcode(beforeConstant.getPrevious());
            return xorMask != null && isIntegerConstant(xorMask)
                    && previousOpcode(xorMask.getPrevious()) != null
                    && previousOpcode(xorMask.getPrevious()).getOpcode() == Opcodes.IAND;
        }
        return previous.getOpcode() == Opcodes.IAND
                || previous instanceof MethodInsnNode call && isComposerChangedCall(call)
                        && COMPOSER.equals(call.owner);
    }

    private static boolean isIntegerConstant(AbstractInsnNode insn) {
        int opcode = insn.getOpcode();
        if (opcode >= Opcodes.ICONST_M1 && opcode <= Opcodes.ICONST_5
                || opcode == Opcodes.BIPUSH || opcode == Opcodes.SIPUSH) return true;
        return insn instanceof LdcInsnNode ldc && ldc.cst instanceof Integer;
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
            List<AbstractInsnNode> block = instructionsUntilThrow(defaultLabel, insn);
            if (isComposeExhaustiveSwitchFallback(block)) {
                AbstractInsnNode first = block.get(0);
                AbstractInsnNode thrown = block.get(block.size() - 1);
                if (!isAlreadyFilteredBranch(output, insn) && isEnumMappingSwitch(insn, context)) {
                    output.replaceBranches(insn, Replacements.ignoreDefaultBranch(insn));
                    audit(context, method, insn, insn,
                            "exhaustive Compose enum switch default outcome");
                }
                output.ignore(first, thrown);
                audit(context, method, first, thrown,
                        "composable switch default NoWhenBranchMatchedException");
            }
        }
    }

    private static boolean isEnumMappingSwitch(AbstractInsnNode insn, IFilterContext context) {
        if (!(insn instanceof TableSwitchInsnNode || insn instanceof LookupSwitchInsnNode)) return false;
        AbstractInsnNode arrayLoad = previousOpcode(insn.getPrevious());
        AbstractInsnNode ordinal = previousOpcode(arrayLoad == null ? null : arrayLoad.getPrevious());
        AbstractInsnNode swap = previousOpcode(ordinal == null ? null : ordinal.getPrevious());
        AbstractInsnNode mapping = previousOpcode(swap == null ? null : swap.getPrevious());
        return arrayLoad != null && arrayLoad.getOpcode() == Opcodes.IALOAD
                && ordinal instanceof MethodInsnNode ordinalCall
                && ordinalCall.getOpcode() == Opcodes.INVOKEVIRTUAL
                && ("java/lang/Enum".equals(ordinalCall.owner) || ENUM_CLASSES.contains(ordinalCall.owner))
                && "ordinal".equals(ordinalCall.name) && "()I".equals(ordinalCall.desc)
                && swap != null && swap.getOpcode() == Opcodes.SWAP
                && mapping instanceof FieldInsnNode field
                && field.getOpcode() == Opcodes.GETSTATIC
                && field.name.startsWith("$EnumSwitchMapping$")
                && isEnclosingWhenMappingsOwner(field.owner, context.getClassName())
                && "[I".equals(field.desc);
    }

    private static boolean isEnclosingWhenMappingsOwner(String mappingOwner, String className) {
        int nestedClass = className.indexOf('$');
        String enclosingClass = nestedClass < 0 ? className : className.substring(0, nestedClass);
        return mappingOwner.startsWith(enclosingClass + "$") && mappingOwner.endsWith("$WhenMappings");
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

    private static List<AbstractInsnNode> instructionsUntilThrow(AbstractInsnNode label,
            AbstractInsnNode switchInstruction) {
        List<AbstractInsnNode> result = new ArrayList<>();
        Set<LabelNode> otherCases = new java.util.HashSet<>();
        if (switchInstruction instanceof TableSwitchInsnNode table) {
            otherCases.addAll(table.labels);
            if (otherCases.contains(table.dflt)) return result;
        } else if (switchInstruction instanceof LookupSwitchInsnNode lookup) {
            otherCases.addAll(lookup.labels);
            if (otherCases.contains(lookup.dflt)) return result;
        }
        for (AbstractInsnNode insn = label.getNext(); insn != null; insn = insn.getNext()) {
            if (insn.getOpcode() >= 0) {
                result.add(insn);
                if (insn.getOpcode() == Opcodes.ATHROW) break;
            } else if (insn instanceof LabelNode caseLabel && !result.isEmpty()
                    && otherCases.contains(caseLabel)) {
                // Ignore debug/local-variable labels but stop at the next switch case target.
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
