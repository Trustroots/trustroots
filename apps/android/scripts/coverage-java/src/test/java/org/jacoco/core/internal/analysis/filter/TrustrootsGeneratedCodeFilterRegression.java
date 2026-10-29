package org.jacoco.core.internal.analysis.filter;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.nio.file.Files;
import java.nio.file.Path;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.AnnotationNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.JumpInsnNode;
import org.objectweb.asm.tree.LabelNode;
import org.objectweb.asm.tree.LineNumberNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.TableSwitchInsnNode;
import org.objectweb.asm.tree.TypeInsnNode;

/** Standalone regression harness; run with the regressionTest Gradle task. */
public final class TrustrootsGeneratedCodeFilterRegression {
    private static final String COMPOSER = "androidx/compose/runtime/Composer";
    private static final String COMPOSABLE = "Landroidx/compose/runtime/Composable;";
    private static final String NO_WHEN = "kotlin/NoWhenBranchMatchedException";

    private TrustrootsGeneratedCodeFilterRegression() {}

    public static void main(String[] args) throws Exception {
        testExactComposableSwitchFallbackIsIgnoredWithoutIgnoringItsDecision();
        testEnumMappedComposeSwitchDefaultOutcomeIsReplaced();
        testCustomOrdinalMethodDoesNotPassEnumRegistry();
        testEnumMappedSwitchWithSourceDefaultIsPreserved();
        testCustomEnumFilterSkipsUpstreamReplacedSwitch();
        testSwitchFallbackWithoutComposeScaffoldIsPreserved();
        testOnlyAStandaloneComposeEndGroupLineIsIgnored();
        testImplicitSuspendCompletionOnClosingLineIsIgnored();
        testExplicitUnitReturnIsPreserved();
        testGenericFlowCompletionIsPreserved();
        testPointerInputCompletionIsFilteredOnlyAfterKnownLoopingApi();
        testFunctionReferenceForwarderIsIgnoredButOrdinaryLambdaIsNot();
        testCapturedStateRememberMaskDecisionsAreFilteredIndividually();
        testEnumCaptureInRememberMaskRegionIsFilteredWithoutHidingSourceConditions();
        testEnumOrdinalSourceDecisionInRememberRegionIsPreserved();
        testSourceDecisionInsideRememberMarkerIsPreserved();
        testSourceBitmaskUsingChangedInstanceIsPreservedWithoutCompilerLocal();
        testComposeDefaultMaskDecisionsAreFilteredWithinDefaultsBlock();
        testComposableDefaultMaskDispatchIsFilteredWithoutHidingExpression();
        testComposableSecondChangedMaskSlotIsNotTreatedAsDefaultMask();
        testComposableDefaultExpressionBranchIsPreserved();
        testCustomDefaultFilterSkipsUpstreamIgnoredBranches();
        org.trustroots.android.coverage.FilteredReportIntegrationRegression.run();
        System.out.println("Trustroots generated-code filter regression checks passed.");
    }

    private static void testExactComposableSwitchFallbackIsIgnoredWithoutIgnoringItsDecision() {
        MethodNode method = composableMethod("draw", "(Landroidx/compose/runtime/Composer;I)V");
        LabelNode defaultLabel = new LabelNode();
        LabelNode caseLabel = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new TableSwitchInsnNode(0, 0, defaultLabel, caseLabel));
        method.instructions.add(defaultLabel);
        method.instructions.add(new LineNumberNode(41, defaultLabel));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode(101));
        method.instructions.add(call("startReplaceGroup", "(I)V"));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(call("endReplaceGroup", "()V"));
        method.instructions.add(new TypeInsnNode(Opcodes.NEW, NO_WHEN));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.DUP));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESPECIAL, NO_WHEN, "<init>", "()V", false));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ATHROW));
        method.instructions.add(caseLabel);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.maxStack = 3;
        method.maxLocals = 2;

        RecordingOutput output = apply(method, "sample/Composable", "java/lang/Object");
        check(output.ignored.size() == 1, "exact generated fallback should be ignored once");
        AbstractInsnNode[] ignored = output.ignored.get(0);
        check(ignored[0].getOpcode() == Opcodes.ALOAD, "ignore should begin at generated Compose setup");
        check(ignored[1].getOpcode() == Opcodes.ATHROW, "ignore should end at the generated throw");
        check(output.ignored.stream().noneMatch(range -> containsBranch(range[0], range[1])),
                "switch decision must stay in branch coverage");
        check(output.replacements.isEmpty(), "an integer switch must not receive enum-default replacement");
    }

    private static void testEnumMappedComposeSwitchDefaultOutcomeIsReplaced() {
        TrustrootsGeneratedCodeFilter.setEnumClassNames(Set.of("sample/Color"));
        MethodNode method = enumComposeSwitch(true, "sample/Color");
        TrustrootsGeneratedCodeFilter.clearAudit();

        RecordingOutput output = apply(method, "sample/EnumComposable", "java/lang/Object");

        check(output.ignored.size() == 1,
                "the exact Compose generated exception block should be ignored");
        check(output.replacements.size() == 1 && output.replacements.get(0).source instanceof TableSwitchInsnNode,
                "the proven enum switch should replace its single impossible default outcome");
        check(TrustrootsGeneratedCodeFilter.filteredBranchDecisionCount() == 0,
                "a switch outcome must not be counted as a two-outcome conditional decision");
        check(TrustrootsGeneratedCodeFilter.filteredBranchOutcomeCount() == 1,
                "the enum default replacement should account for exactly one removed outcome");
    }

    private static void testEnumMappedSwitchWithSourceDefaultIsPreserved() {
        TrustrootsGeneratedCodeFilter.setEnumClassNames(Set.of("sample/Color"));
        MethodNode method = enumComposeSwitch(false, "sample/Color");
        LabelNode defaultLabel = null;
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof TableSwitchInsnNode table) defaultLabel = table.dflt;
        }
        check(defaultLabel != null, "fixture should contain an enum switch");
        method.instructions.insert(defaultLabel, new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));

        RecordingOutput output = apply(method, "sample/EnumComposableSourceDefault", "java/lang/Object");

        check(output.replacements.isEmpty(),
                "a source-bearing default case must remain measured even with enum mapping bytecode");
        check(output.ignored.isEmpty(), "a source-bearing default must not be hidden by the Compose fallback rule");
    }

    private static void testCustomOrdinalMethodDoesNotPassEnumRegistry() {
        TrustrootsGeneratedCodeFilter.setEnumClassNames(Set.of("sample/Color"));
        MethodNode method = enumComposeSwitch(true, "sample/OrdinalLike");

        RecordingOutput output = apply(method, "sample/EnumComposable", "java/lang/Object");

        check(output.replacements.isEmpty(),
                "an ordinal-shaped call on a non-enum class must not erase an exhaustive switch outcome");
    }

    private static MethodNode enumComposeSwitch(boolean generatedDefault, String ordinalOwner) {
        MethodNode method = composableMethod("drawEnum",
                "(Landroidx/compose/runtime/Composer;Ljava/lang/Enum;)V");
        LabelNode defaultLabel = new LabelNode();
        LabelNode caseLabel = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC, "sample/EnumComposable$WhenMappings",
                "$EnumSwitchMapping$0", "[I"));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.SWAP));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, ordinalOwner,
                "ordinal", "()I", false));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IALOAD));
        method.instructions.add(new TableSwitchInsnNode(1, 1, defaultLabel, caseLabel));
        method.instructions.add(defaultLabel);
        if (generatedDefault) {
            method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
            method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode(101));
            method.instructions.add(call("startReplaceGroup", "(I)V"));
            method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
            method.instructions.add(call("endReplaceGroup", "()V"));
            method.instructions.add(new TypeInsnNode(Opcodes.NEW, NO_WHEN));
            method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.DUP));
            method.instructions.add(new MethodInsnNode(Opcodes.INVOKESPECIAL, NO_WHEN, "<init>", "()V", false));
            method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ATHROW));
        } else {
            method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.NOP));
        }
        method.instructions.add(caseLabel);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.maxStack = 3;
        method.maxLocals = 2;
        return method;
    }

    private static void testCustomEnumFilterSkipsUpstreamReplacedSwitch() {
        TrustrootsGeneratedCodeFilter.setEnumClassNames(Set.of("sample/Color"));
        MethodNode method = enumComposeSwitch(true, "sample/Color");
        TableSwitchInsnNode switchInsn = null;
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof TableSwitchInsnNode table) switchInsn = table;
        }
        check(switchInsn != null, "fixture should contain an enum switch");
        RecordingOutput delegate = new RecordingOutput();
        TrackingFilterOutput tracking = new TrackingFilterOutput(delegate);
        tracking.replaceBranches(switchInsn, Replacements.ignoreDefaultBranch(switchInsn));
        TrustrootsGeneratedCodeFilter.clearAudit();

        new TrustrootsGeneratedCodeFilter().filter(method,
                new FakeContext("sample/EnumAlreadyReplaced", "java/lang/Object"), tracking);

        check(delegate.replacements.size() == 1,
                "the custom filter must not replace an enum switch already handled upstream");
        check(TrustrootsGeneratedCodeFilter.filteredBranchOutcomeCount() == 0,
                "an upstream replacement must not be counted as a custom audited outcome");
    }

    private static void testSwitchFallbackWithoutComposeScaffoldIsPreserved() {
        MethodNode method = composableMethod("draw", "(Landroidx/compose/runtime/Composer;I)V");
        LabelNode defaultLabel = new LabelNode();
        LabelNode caseLabel = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new TableSwitchInsnNode(0, 0, defaultLabel, caseLabel));
        method.instructions.add(defaultLabel);
        method.instructions.add(new TypeInsnNode(Opcodes.NEW, NO_WHEN));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.DUP));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESPECIAL, NO_WHEN, "<init>", "()V", false));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ATHROW));
        method.instructions.add(caseLabel);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.maxStack = 2;
        method.maxLocals = 2;

        check(apply(method, "sample/Composable", "java/lang/Object").ignored.isEmpty(),
                "fallback without the Compose-only bytecode scaffold must remain visible");
    }

    private static void testOnlyAStandaloneComposeEndGroupLineIsIgnored() {
        MethodNode method = composableMethod("draw", "(Landroidx/compose/runtime/Composer;)V");
        LabelNode startLine = new LabelNode();
        LabelNode closeLine = new LabelNode();
        LabelNode mixedLine = new LabelNode();
        method.instructions.add(startLine);
        method.instructions.add(new LineNumberNode(10, startLine));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(call("startReplaceGroup", "(I)V"));
        method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode(9));
        method.instructions.add(closeLine);
        method.instructions.add(new LineNumberNode(11, closeLine));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        MethodInsnNode generatedClose = call("endReplaceGroup", "()V");
        method.instructions.add(generatedClose);
        method.instructions.add(mixedLine);
        method.instructions.add(new LineNumberNode(12, mixedLine));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(call("endReplaceGroup", "()V"));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.POP));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.maxStack = 2;
        method.maxLocals = 1;

        RecordingOutput output = apply(method, "sample/Composable", "java/lang/Object");
        check(output.ignored.size() == 1, "only the generated-only close line should be ignored");
        check(output.ignored.get(0)[0].getOpcode() == Opcodes.ALOAD
                        && output.ignored.get(0)[1] == generatedClose,
                "the source-bearing close line must not be filtered");
        check(output.ignored.stream().noneMatch(range -> containsBranch(range[0], range[1])),
                "group-close filtering must not remove branches");
    }

    private static void testImplicitSuspendCompletionOnClosingLineIsIgnored() throws Exception {
        MethodNode method = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC, "invokeSuspend",
                "(Ljava/lang/Object;)Ljava/lang/Object;", null, null);
        LabelNode suspendLine = new LabelNode();
        method.instructions.add(suspendLine);
        method.instructions.add(new LineNumberNode(19, suspendLine));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new TypeInsnNode(Opcodes.CHECKCAST, "kotlin/coroutines/Continuation"));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC,
                "androidx/compose/runtime/SnapshotStateKt", "snapshotFlow",
                "(Lkotlin/jvm/functions/Function0;)Lkotlinx/coroutines/flow/Flow;", false));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE,
                "kotlinx/coroutines/flow/Flow", "collect",
                "(Lkotlinx/coroutines/flow/FlowCollector;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;",
                true));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.POP));
        LabelNode completionLine = new LabelNode();
        method.instructions.add(completionLine);
        method.instructions.add(new LineNumberNode(20, completionLine));
        AbstractInsnNode generatedUnit = new FieldInsnNode(Opcodes.GETSTATIC, "kotlin/Unit", "INSTANCE", "Lkotlin/Unit;");
        AbstractInsnNode generatedReturn = new org.objectweb.asm.tree.InsnNode(Opcodes.ARETURN);
        method.instructions.add(generatedUnit);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 3));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 9));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.BASTORE));
        method.instructions.add(generatedReturn);
        LabelNode invalidState = new LabelNode();
        method.instructions.add(invalidState);
        method.instructions.add(new LineNumberNode(21, invalidState));
        method.instructions.add(new TypeInsnNode(Opcodes.NEW, "java/lang/IllegalStateException"));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.DUP));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESPECIAL, "java/lang/IllegalStateException",
                "<init>", "()V", false));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ATHROW));
        method.maxStack = 2;
        method.maxLocals = 2;

        withSourceLine("},", () -> {
            RecordingOutput output = apply(method, "sample/LoopLambda", SUSPEND_LAMBDA);
            check(output.ignored.size() == 1, "implicit completion on a source-only closing line should be ignored");
            check(output.ignored.get(0)[0] == generatedUnit && output.ignored.get(0)[1] == generatedReturn,
                    "filter should ignore the generated Unit/return tail and its probe store");
        });
    }

    private static void testExplicitUnitReturnIsPreserved() throws Exception {
        MethodNode method = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC, "invokeSuspend",
                "(Ljava/lang/Object;)Ljava/lang/Object;", null, null);
        LabelNode line = new LabelNode();
        method.instructions.add(line);
        method.instructions.add(new LineNumberNode(20, line));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new TypeInsnNode(Opcodes.CHECKCAST, "kotlin/coroutines/Continuation"));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC,
                "androidx/compose/runtime/SnapshotStateKt", "snapshotFlow",
                "(Lkotlin/jvm/functions/Function0;)Lkotlinx/coroutines/flow/Flow;", false));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE,
                "kotlinx/coroutines/flow/Flow", "collect",
                "(Lkotlinx/coroutines/flow/FlowCollector;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;",
                true));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.POP));
        method.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC, "kotlin/Unit", "INSTANCE", "Lkotlin/Unit;"));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ARETURN));
        method.maxStack = 2;
        method.maxLocals = 2;

        withSourceLine("return Unit", () -> {
            check(apply(method, "sample/LoopLambda", SUSPEND_LAMBDA).ignored.isEmpty(),
                    "explicit return Unit must remain covered source code");
        });
    }

    private static void testGenericFlowCompletionIsPreserved() throws Exception {
        MethodNode method = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC, "invokeSuspend",
                "(Ljava/lang/Object;)Ljava/lang/Object;", null, null);
        LabelNode line = new LabelNode();
        method.instructions.add(line);
        method.instructions.add(new LineNumberNode(20, line));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE,
                "kotlinx/coroutines/flow/Flow", "collect",
                "(Lkotlinx/coroutines/flow/FlowCollector;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;",
                true));
        method.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC, "kotlin/Unit", "INSTANCE", "Lkotlin/Unit;"));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ARETURN));
        method.maxStack = 2;
        method.maxLocals = 2;

        withSourceLine("},", () -> {
            check(apply(method, "sample/LoopLambda", SUSPEND_LAMBDA).ignored.isEmpty(),
                    "generic Flow.collect completion must remain measurable");
        });
    }

    private static void testPointerInputCompletionIsFilteredOnlyAfterKnownLoopingApi() throws Exception {
        MethodNode method = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC, "invoke",
                "(Landroidx/compose/ui/input/pointer/PointerInputScope;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;",
                null, null);
        LabelNode callLine = new LabelNode();
        method.instructions.add(callLine);
        method.instructions.add(new LineNumberNode(19, callLine));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE,
                "androidx/compose/ui/input/pointer/PointerInputScope", "awaitPointerEventScope",
                "(Lkotlin/jvm/functions/Function2;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", true));
        LabelNode completionLine = new LabelNode();
        method.instructions.add(completionLine);
        method.instructions.add(new LineNumberNode(20, completionLine));
        AbstractInsnNode generatedUnit = new FieldInsnNode(Opcodes.GETSTATIC, "kotlin/Unit", "INSTANCE", "Lkotlin/Unit;");
        AbstractInsnNode generatedReturn = new org.objectweb.asm.tree.InsnNode(Opcodes.ARETURN);
        method.instructions.add(generatedUnit);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 4));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_2));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.BASTORE));
        method.instructions.add(generatedReturn);
        method.maxStack = 2;
        method.maxLocals = 5;

        withSourceLine("},", () -> {
            RecordingOutput output = apply(method, "sample/PointerInput", "java/lang/Object");
            check(output.ignored.size() == 1 && output.ignored.get(0)[0] == generatedUnit
                            && output.ignored.get(0)[1] == generatedReturn,
                    "known pointer-input scope loop should permit filtering only the generated tail");
        });

        MethodNode gestureHandler = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC, "invoke",
                "(Landroidx/compose/ui/input/pointer/PointerInputScope;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;",
                null, null);
        LabelNode gestureLine = new LabelNode();
        gestureHandler.instructions.add(gestureLine);
        gestureHandler.instructions.add(new LineNumberNode(19, gestureLine));
        gestureHandler.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC,
                "androidx/compose/foundation/gestures/TransformGestureDetectorKt",
                "detectTransformGestures$default",
                "(Landroidx/compose/ui/input/pointer/PointerInputScope;ZLkotlin/jvm/functions/Function4;Lkotlin/coroutines/Continuation;ILjava/lang/Object;)Ljava/lang/Object;",
                false));
        gestureHandler.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC,
                "kotlin/Unit", "INSTANCE", "Lkotlin/Unit;"));
        LabelNode gestureCompletionLine = new LabelNode();
        gestureHandler.instructions.add(gestureCompletionLine);
        gestureHandler.instructions.add(new LineNumberNode(20, gestureCompletionLine));
        gestureHandler.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ARETURN));
        gestureHandler.maxStack = 2;
        gestureHandler.maxLocals = 3;
        withSourceLine("},", () -> check(apply(gestureHandler, "sample/GestureInput", "java/lang/Object")
                        .ignored.size() == 1,
                "detectTransformGestures completion should match the same narrow generated-tail rule"));

        MethodNode ordinary = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC, "invoke",
                "()Ljava/lang/Object;", null, null);
        ordinary.instructions.add(new LabelNode());
        ordinary.instructions.add(new LineNumberNode(20, (LabelNode) ordinary.instructions.getFirst()));
        ordinary.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC, "kotlin/Unit", "INSTANCE", "Lkotlin/Unit;"));
        ordinary.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ARETURN));
        withSourceLine("},", () -> check(apply(ordinary, "sample/PointerInput", "java/lang/Object").ignored.isEmpty(),
                "a closing delimiter without a known non-completing API remains measurable"));
    }

    private static void testFunctionReferenceForwarderIsIgnoredButOrdinaryLambdaIsNot() {
        MethodNode method = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC, "invoke",
                "(I)Ljava/lang/Object;", null, null);
        LabelNode line = new LabelNode();
        method.instructions.add(line);
        method.instructions.add(new LineNumberNode(30, line));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "sample/Factory", "create",
                "(I)Ljava/lang/Object;", false));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ARETURN));
        method.maxStack = 2;
        method.maxLocals = 2;

        RecordingOutput referenceOutput = new RecordingOutput();
        new TrustrootsGeneratedCodeFilter().filter(method,
                new FakeContext("sample/FactoryReference$1", "kotlin/jvm/internal/FunctionReferenceImpl"),
                referenceOutput);
        check(referenceOutput.ignored.size() == 1,
                "a branch-free FunctionReferenceImpl forwarding method should be filtered");
        check(referenceOutput.ignored.stream().noneMatch(range -> containsBranch(range[0], range[1])),
                "callable-reference forwarding must not alter branch coverage");

        RecordingOutput lambdaOutput = new RecordingOutput();
        new TrustrootsGeneratedCodeFilter().filter(method,
                new FakeContext("sample/OrdinaryLambda$1", "kotlin/jvm/internal/Lambda"), lambdaOutput);
        check(lambdaOutput.ignored.isEmpty(), "ordinary Lambda subclasses must remain fully measurable");

        RecordingOutput javaSubclassOutput = new RecordingOutput();
        new TrustrootsGeneratedCodeFilter().filter(method,
                new FakeContext("sample/HandwrittenReference$1",
                        "kotlin/jvm/internal/FunctionReferenceImpl", false), javaSubclassOutput);
        check(javaSubclassOutput.ignored.isEmpty(),
                "a Java class with a callable-reference superclass must not be treated as Kotlin generated code");
    }

    private static void testCapturedStateRememberMaskDecisionsAreFilteredIndividually() {
        MethodNode method = composableMethod("rememberLambda", "(Landroidx/compose/runtime/Composer;II)V");
        method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode("CC(remember):Sample.kt#abc"));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerStart", "(Landroidx/compose/runtime/Composer;ILjava/lang/String;)V", false));

        LabelNode set = new LabelNode();
        LabelNode clear = new LabelNode();
        LabelNode join = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 14));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 6));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IXOR));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_4));
        method.instructions.add(new JumpInsnNode(Opcodes.IF_ICMPLE, set));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 8));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, clear));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 2));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "changedInstance", "(Ljava/lang/Object;)Z", true));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, clear));
        method.instructions.add(set);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new JumpInsnNode(Opcodes.GOTO, join));
        method.instructions.add(clear);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
        method.instructions.add(join);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ISTORE, 3));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "rememberedValue", "()Ljava/lang/Object;", true));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ASTORE, 4));
        LabelNode create = new LabelNode();
        LabelNode cached = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 3));
        method.instructions.add(new JumpInsnNode(Opcodes.IFNE, create));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 4));
        method.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC,
                "androidx/compose/runtime/Composer", "Companion", "Landroidx/compose/runtime/Composer$Companion;"));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL,
                "androidx/compose/runtime/Composer$Companion", "getEmpty", "()Ljava/lang/Object;", false));
        method.instructions.add(new JumpInsnNode(Opcodes.IF_ACMPNE, cached));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerEnd", "(Landroidx/compose/runtime/Composer;)V", false));
        method.instructions.add(create);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.instructions.add(cached);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.localVariables = new ArrayList<>();
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed", "I", null, new LabelNode(), new LabelNode(), 1));

        RecordingOutput output = apply(method, "sample/Remember", "java/lang/Object");
        long ignoredBranches = output.ignored.stream()
                .filter(range -> range[0] instanceof JumpInsnNode && range[0] == range[1]).count();
        check(ignoredBranches == 3,
                "only the two mask tests and captured-state comparison should be removed; saw "
                        + ignoredBranches + " ranges=" + output.ignored.size());
        check(output.ignored.stream().noneMatch(range -> range[0] instanceof JumpInsnNode
                        && range[0].getOpcode() == Opcodes.IFNE),
                "the actual remembered-value invalidation gate must remain measured");
    }

    private static void testEnumCaptureInRememberMaskRegionIsFilteredWithoutHidingSourceConditions() {
        MethodNode method = enumRememberMaskMethod(true, false);
        RecordingOutput output = apply(method, "sample/RememberEnum", "java/lang/Object");
        List<JumpInsnNode> ignoredBranches = output.ignored.stream()
                .filter(range -> range[0] instanceof JumpInsnNode && range[0] == range[1])
                .map(range -> (JumpInsnNode) range[0])
                .toList();
        check(ignoredBranches.size() == 3,
                "only compiler mask decisions around the enum cache key should be ignored; found "
                        + ignoredBranches.size() + " ignored ranges " + output.ignored.size());
        check(ignoredBranches.stream().noneMatch(branch -> branch.getOpcode() == Opcodes.IFEQ
                        && branch.getPrevious() != null
                        && branch.getPrevious().getOpcode() == Opcodes.ILOAD),
                "the ordinary source boolean decision in the same remember region must remain measured");
    }

    private static void testEnumOrdinalSourceDecisionInRememberRegionIsPreserved() {
        MethodNode method = enumRememberMaskMethod(false, true);
        RecordingOutput output = apply(method, "sample/RememberEnumSource", "java/lang/Object");
        check(output.ignored.isEmpty(),
                "an enum ordinal used by a source condition must prevent the remember mask match");
    }

    private static MethodNode enumRememberMaskMethod(boolean includeSourceBoolean, boolean includeSourceEnumDecision) {
        MethodNode method = composableMethod("rememberEnumLambda",
                "(Landroidx/compose/runtime/Composer;I)V");
        method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode("CC(remember):Sample.kt#enum-key"));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerStart", "(Landroidx/compose/runtime/Composer;ILjava/lang/String;)V", false));

        LabelNode set = new LabelNode();
        LabelNode clear = new LabelNode();
        LabelNode join = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 14));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_4));
        method.instructions.add(new JumpInsnNode(Opcodes.IF_ICMPEQ, set));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 8));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, clear));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 2));
        method.instructions.add(new TypeInsnNode(Opcodes.CHECKCAST, "java/lang/Enum"));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, "java/lang/Enum", "ordinal", "()I", false));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "changed", "(I)Z", true));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, clear));

        LabelNode sourceBooleanFalse = new LabelNode();
        if (includeSourceBoolean) {
            method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 3));
            method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, sourceBooleanFalse));
            method.instructions.add(sourceBooleanFalse);
        }
        if (includeSourceEnumDecision) {
            LabelNode sourceEnumFalse = new LabelNode();
            method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 2));
            method.instructions.add(new TypeInsnNode(Opcodes.CHECKCAST, "java/lang/Enum"));
            method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, "java/lang/Enum", "ordinal", "()I", false));
            method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
            method.instructions.add(new JumpInsnNode(Opcodes.IF_ICMPNE, sourceEnumFalse));
            method.instructions.add(sourceEnumFalse);
        }

        method.instructions.add(set);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new JumpInsnNode(Opcodes.GOTO, join));
        method.instructions.add(clear);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
        method.instructions.add(join);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ISTORE, 4));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "rememberedValue", "()Ljava/lang/Object;", true));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ASTORE, 5));
        LabelNode create = new LabelNode();
        LabelNode cached = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 4));
        method.instructions.add(new JumpInsnNode(Opcodes.IFNE, create));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 5));
        method.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC,
                "androidx/compose/runtime/Composer", "Companion", "Landroidx/compose/runtime/Composer$Companion;"));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL,
                "androidx/compose/runtime/Composer$Companion", "getEmpty", "()Ljava/lang/Object;", false));
        method.instructions.add(new JumpInsnNode(Opcodes.IF_ACMPNE, cached));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "rememberedValue", "()Ljava/lang/Object;", true));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.POP));
        method.instructions.add(create);
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerEnd", "(Landroidx/compose/runtime/Composer;)V", false));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.instructions.add(cached);
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerEnd", "(Landroidx/compose/runtime/Composer;)V", false));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.localVariables = new ArrayList<>();
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed", "I", null, new LabelNode(), new LabelNode(), 1));
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "destination", "Lsample/Mode;", null, new LabelNode(), new LabelNode(), 2));
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "sourceBoolean", "Z", null, new LabelNode(), new LabelNode(), 3));
        return method;
    }

    private static void testSourceDecisionInsideRememberMarkerIsPreserved() {
        MethodNode method = composableMethod("rememberWithSourceDecision", "(Landroidx/compose/runtime/Composer;Z)V");
        method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode("CC(remember):Sample.kt#source"));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerStart", "(Landroidx/compose/runtime/Composer;ILjava/lang/String;)V", false));
        LabelNode sourceFalse = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        JumpInsnNode sourceDecision = new JumpInsnNode(Opcodes.IFEQ, sourceFalse);
        method.instructions.add(sourceDecision);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "rememberedValue", "()Ljava/lang/Object;", true));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ASTORE, 2));
        LabelNode create = new LabelNode();
        LabelNode cached = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new JumpInsnNode(Opcodes.IFNE, create));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 2));
        method.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC,
                "androidx/compose/runtime/Composer", "Companion", "Landroidx/compose/runtime/Composer$Companion;"));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL,
                "androidx/compose/runtime/Composer$Companion", "getEmpty", "()Ljava/lang/Object;", false));
        method.instructions.add(new JumpInsnNode(Opcodes.IF_ACMPNE, cached));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerEnd", "(Landroidx/compose/runtime/Composer;)V", false));
        method.instructions.add(create);
        method.instructions.add(sourceFalse);
        method.instructions.add(cached);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));

        RecordingOutput output = apply(method, "sample/RememberSource", "java/lang/Object");
        check(output.ignored.isEmpty(),
                "a source-level condition that is not a changed-mask expression must remain measured");
    }

    private static void testSourceBitmaskUsingChangedInstanceIsPreservedWithoutCompilerLocal() {
        MethodNode method = composableMethod("sourceMask", "(Landroidx/compose/runtime/Composer;III)V");
        method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode("CC(remember):Sample.kt#source-mask"));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerStart", "(Landroidx/compose/runtime/Composer;ILjava/lang/String;)V", false));
        LabelNode sourceFlagFalse = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 2));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, sourceFlagFalse));
        LabelNode set = new LabelNode();
        LabelNode clear = new LabelNode();
        LabelNode join = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 14));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_4));
        method.instructions.add(new JumpInsnNode(Opcodes.IF_ICMPEQ, set));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.IntInsnNode(Opcodes.BIPUSH, 8));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, clear));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 3));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "changedInstance", "(Ljava/lang/Object;)Z", true));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, clear));
        method.instructions.add(set);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new JumpInsnNode(Opcodes.GOTO, join));
        method.instructions.add(clear);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_0));
        method.instructions.add(join);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ISTORE, 3));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "rememberedValue", "()Ljava/lang/Object;", true));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ASTORE, 4));
        LabelNode create = new LabelNode();
        LabelNode cached = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 3));
        method.instructions.add(new JumpInsnNode(Opcodes.IFNE, create));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 4));
        method.instructions.add(new FieldInsnNode(Opcodes.GETSTATIC,
                "androidx/compose/runtime/Composer", "Companion", "Landroidx/compose/runtime/Composer$Companion;"));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL,
                "androidx/compose/runtime/Composer$Companion", "getEmpty", "()Ljava/lang/Object;", false));
        method.instructions.add(new JumpInsnNode(Opcodes.IF_ACMPNE, cached));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 0));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "androidx/compose/runtime/ComposerKt",
                "sourceInformationMarkerEnd", "(Landroidx/compose/runtime/Composer;)V", false));
        method.instructions.add(sourceFlagFalse);
        method.instructions.add(create);
        method.instructions.add(cached);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.localVariables = new ArrayList<>();
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed", "I", null, new LabelNode(), new LabelNode(), 1));
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "sourceFlags", "I", null, new LabelNode(), new LabelNode(), 2));

        check(apply(method, "sample/SourceMask", "java/lang/Object").ignored.isEmpty(),
                "a source bitmask mixed with a valid compiler mask must remain measured in full");
    }

    private static void testComposeDefaultMaskDecisionsAreFilteredWithinDefaultsBlock() {
        MethodNode generated = defaultArgumentMethod(true);
        RecordingOutput generatedOutput = apply(generated, "sample/DefaultArguments", "java/lang/Object");
        long filteredDecisions = generatedOutput.ignored.stream()
                .filter(range -> range[0] instanceof JumpInsnNode && range[0] == range[1]).count();
        check(filteredDecisions == 3,
                "only the hidden changed/default masks and Composer defaults-invalid check should be filtered");
        check(generatedOutput.ignored.stream().noneMatch(range -> range[0] instanceof JumpInsnNode jump
                        && isSourceFlagDecision(jump)),
                "the source flag branch in the default value expression must remain measured");

        MethodNode incomplete = defaultArgumentMethod(false);
        check(apply(incomplete, "sample/IncompleteDefaults", "java/lang/Object").ignored.isEmpty(),
                "mask-shaped branches without the complete Compose defaults framework must remain measured");
    }

    private static MethodNode defaultArgumentMethod(boolean includeSkipToGroupEnd) {
        MethodNode method = composableMethod("defaultedComposable",
                "(ILandroidx/compose/runtime/Composer;II)V");
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "startDefaults", "()V", true));
        LabelNode useDefaultValue = new LabelNode();
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 2));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, useDefaultValue));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "getDefaultsInvalid", "()Z", true));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, useDefaultValue));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 3));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_2));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(new JumpInsnNode(Opcodes.IFEQ, useDefaultValue));
        LabelNode sourceFalse = new LabelNode();
        JumpInsnNode sourceDecision = new JumpInsnNode(Opcodes.IFEQ, sourceFalse);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 0));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(sourceDecision);
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "sample/DefaultValue",
                "evaluate", "()V", false));
        method.instructions.add(useDefaultValue);
        if (includeSkipToGroupEnd) {
            method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
            method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                    "skipToGroupEnd", "()V", true));
        }
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "endDefaults", "()V", true));
        method.instructions.add(sourceFalse);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.localVariables = new ArrayList<>();
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed", "I", null, new LabelNode(), new LabelNode(), 2));
        return method;
    }

    private static void testComposableDefaultMaskDispatchIsFilteredWithoutHidingExpression() {
        MethodNode method = composableMethod("defaultDispatch",
                "(Ljava/lang/Object;Landroidx/compose/runtime/Composer;II)V");
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 2));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "shouldExecute", "(ZI)Z", true));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.POP));
        LabelNode suppliedValue = new LabelNode();
        JumpInsnNode defaultDecision = new JumpInsnNode(Opcodes.IFEQ, suppliedValue);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 3));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(defaultDecision);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ACONST_NULL));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ASTORE, 0));
        method.instructions.add(suppliedValue);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.localVariables = new ArrayList<>();
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed", "I", null, new LabelNode(), new LabelNode(), 2));

        RecordingOutput output = apply(method, "sample/DefaultDispatch", "java/lang/Object");
        check(output.ignored.size() == 1 && output.ignored.get(0)[0] == defaultDecision,
                "a hidden default mask may filter only its direct optional-argument assignment decision");
        check(output.ignored.stream().noneMatch(range -> range[0].getOpcode() == Opcodes.ASTORE),
                "default argument assignment instructions remain measured");
    }

    private static void testComposableDefaultExpressionBranchIsPreserved() {
        MethodNode method = composableMethod("defaultExpressionBranch",
                "(Ljava/lang/Object;ZLandroidx/compose/runtime/Composer;II)V");
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 2));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 3));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "shouldExecute", "(ZI)Z", true));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.POP));
        LabelNode suppliedValue = new LabelNode();
        LabelNode defaultValue = new LabelNode();
        LabelNode valueJoined = new LabelNode();
        JumpInsnNode maskDecision = new JumpInsnNode(Opcodes.IFEQ, suppliedValue);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 4));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(maskDecision);
        JumpInsnNode sourceDefaultDecision = new JumpInsnNode(Opcodes.IFEQ, defaultValue);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 1));
        method.instructions.add(sourceDefaultDecision);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ACONST_NULL));
        method.instructions.add(new JumpInsnNode(Opcodes.GOTO, valueJoined));
        method.instructions.add(defaultValue);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ACONST_NULL));
        method.instructions.add(valueJoined);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ASTORE, 0));
        method.instructions.add(suppliedValue);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.localVariables = new ArrayList<>();
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed", "I", null, new LabelNode(), new LabelNode(), 3));

        check(apply(method, "sample/DefaultExpression", "java/lang/Object").ignored.isEmpty(),
                "a branch inside a default value expression invalidates the mask match and stays measured");
    }

    private static void testComposableSecondChangedMaskSlotIsNotTreatedAsDefaultMask() {
        MethodNode method = composableMethod("secondChangedMask",
                "(Ljava/lang/Object;Landroidx/compose/runtime/Composer;II)V");
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ALOAD, 1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 2));
        method.instructions.add(new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER,
                "shouldExecute", "(ZI)Z", true));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.POP));
        LabelNode suppliedValue = new LabelNode();
        JumpInsnNode candidate = new JumpInsnNode(Opcodes.IFEQ, suppliedValue);
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ILOAD, 3));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.ICONST_1));
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.IAND));
        method.instructions.add(candidate);
        method.instructions.add(new org.objectweb.asm.tree.LdcInsnNode("fallback"));
        method.instructions.add(new org.objectweb.asm.tree.VarInsnNode(Opcodes.ASTORE, 0));
        method.instructions.add(suppliedValue);
        method.instructions.add(new org.objectweb.asm.tree.InsnNode(Opcodes.RETURN));
        method.localVariables = new ArrayList<>();
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed", "I", null, new LabelNode(), new LabelNode(), 2));
        method.localVariables.add(new org.objectweb.asm.tree.LocalVariableNode(
                "$changed1", "I", null, new LabelNode(), new LabelNode(), 3));

        check(apply(method, "sample/SecondChangedMask", "java/lang/Object").ignored.isEmpty(),
                "a second compiler changed-mask slot must not be mistaken for the default mask");
    }

    private static void testCustomDefaultFilterSkipsUpstreamIgnoredBranches() {
        MethodNode method = defaultArgumentMethod(true);
        JumpInsnNode alreadyFiltered = null;
        for (AbstractInsnNode insn : method.instructions) {
            if (insn instanceof JumpInsnNode jump && isDefaultMaskFixtureDecision(jump)) {
                alreadyFiltered = jump;
                break;
            }
        }
        check(alreadyFiltered != null, "fixture should contain a default-mask branch");

        RecordingOutput delegate = new RecordingOutput();
        TrackingFilterOutput tracking = new TrackingFilterOutput(delegate);
        tracking.ignore(alreadyFiltered, alreadyFiltered);
        TrustrootsGeneratedCodeFilter.clearAudit();
        new TrustrootsGeneratedCodeFilter().filter(method,
                new FakeContext("sample/DefaultsAlreadyFiltered", "java/lang/Object"), tracking);

        check(TrustrootsGeneratedCodeFilter.filteredBranchDecisionCount() == 2,
                "the custom audit should omit the branch already removed by an upstream filter");
        check(delegate.ignored.size() == 3,
                "only the two remaining compiler decisions should be ignored in addition to the upstream one");
    }

    private static boolean isDefaultMaskFixtureDecision(JumpInsnNode branch) {
        AbstractInsnNode and = branch.getPrevious();
        AbstractInsnNode bit = and == null ? null : and.getPrevious();
        AbstractInsnNode load = bit == null ? null : bit.getPrevious();
        return and != null && and.getOpcode() == Opcodes.IAND
                && bit != null && bit.getOpcode() == Opcodes.ICONST_1
                && load instanceof org.objectweb.asm.tree.VarInsnNode varLoad
                && varLoad.getOpcode() == Opcodes.ILOAD && varLoad.var == 2;
    }

    private static boolean isSourceFlagDecision(JumpInsnNode branch) {
        AbstractInsnNode and = branch.getPrevious();
        AbstractInsnNode bit = and == null ? null : and.getPrevious();
        AbstractInsnNode load = bit == null ? null : bit.getPrevious();
        return and != null && and.getOpcode() == Opcodes.IAND
                && bit != null && bit.getOpcode() == Opcodes.ICONST_1
                && load instanceof org.objectweb.asm.tree.VarInsnNode varLoad
                && varLoad.getOpcode() == Opcodes.ILOAD && varLoad.var == 0;
    }

    private static void withSourceLine(String sourceLine, Runnable test) throws Exception {
        Path temporaryDirectory = Path.of("build/tmp");
        Files.createDirectories(temporaryDirectory);
        Path root = Files.createTempDirectory(temporaryDirectory, "trustroots-generated-coverage");
        Path source = root.resolve("sample/Generated.kt");
        Files.createDirectories(source.getParent());
        Files.writeString(source, "\n".repeat(19) + sourceLine + "\n");
        String previous = System.getProperty("trustroots.coverage.sourceRoot");
        System.setProperty("trustroots.coverage.sourceRoot", root.toString());
        try {
            test.run();
        } finally {
            if (previous == null) System.clearProperty("trustroots.coverage.sourceRoot");
            else System.setProperty("trustroots.coverage.sourceRoot", previous);
            Files.deleteIfExists(source);
            Files.deleteIfExists(source.getParent());
            Files.deleteIfExists(root);
        }
    }

    private static MethodNode composableMethod(String name, String descriptor) {
        MethodNode method = new MethodNode(Opcodes.ASM9, Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC,
                name, descriptor, null, null);
        method.visibleAnnotations = new ArrayList<>();
        method.visibleAnnotations.add(new AnnotationNode(COMPOSABLE));
        return method;
    }

    private static MethodInsnNode call(String name, String descriptor) {
        return new MethodInsnNode(Opcodes.INVOKEINTERFACE, COMPOSER, name, descriptor, true);
    }

    private static RecordingOutput apply(MethodNode method, String className, String superName) {
        RecordingOutput output = new RecordingOutput();
        new TrustrootsGeneratedCodeFilter().filter(method, new FakeContext(className, superName), output);
        return output;
    }

    private static boolean containsBranch(AbstractInsnNode from, AbstractInsnNode to) {
        for (AbstractInsnNode insn = from; insn != null; insn = insn.getNext()) {
            if (insn instanceof JumpInsnNode || insn instanceof TableSwitchInsnNode
                    || insn instanceof org.objectweb.asm.tree.LookupSwitchInsnNode) return true;
            if (insn == to) return false;
        }
        return false;
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static final class RecordingOutput implements IFilterOutput {
        final List<AbstractInsnNode[]> ignored = new ArrayList<>();
        final List<ReplacementRecord> replacements = new ArrayList<>();
        @Override public void ignore(AbstractInsnNode from, AbstractInsnNode to) {
            ignored.add(new AbstractInsnNode[] { from, to });
        }
        @Override public void merge(AbstractInsnNode first, AbstractInsnNode second) {}
        @Override public void replaceBranches(AbstractInsnNode source, Replacements replacements) {
            this.replacements.add(new ReplacementRecord(source, replacements));
        }
    }

    private record ReplacementRecord(AbstractInsnNode source, Replacements replacements) {}

    private static final class FakeContext implements IFilterContext {
        private final String className;
        private final String superName;
        private final boolean kotlin;
        FakeContext(String className, String superName) { this(className, superName, true); }
        FakeContext(String className, String superName, boolean kotlin) {
            this.className = className;
            this.superName = superName;
            this.kotlin = kotlin;
        }
        @Override public String getClassName() { return className; }
        @Override public String getSuperClassName() { return superName; }
        @Override public Set<String> getClassAnnotations() {
            return kotlin ? Set.of(Filters.KOTLIN_METADATA_DESC) : Set.of();
        }
        @Override public Set<String> getClassAttributes() { return Set.of(); }
        @Override public int getClassAccess() { return Opcodes.ACC_PUBLIC; }
        @Override public String getSourceFileName() { return "Generated.kt"; }
        @Override public KotlinSMAP getKotlinSMAP() { return null; }
    }

    private static final String SUSPEND_LAMBDA = "kotlin/coroutines/jvm/internal/SuspendLambda";
}
