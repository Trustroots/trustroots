/*******************************************************************************
 * Copyright (c) 2009, 2026 Mountainminds GmbH & Co. KG and Contributors
 * This program and the accompanying materials are made available under
 * the terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *    Evgeny Mandrikov - initial API and implementation
 *
 *******************************************************************************/
package org.jacoco.core.internal.analysis.filter;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.JumpInsnNode;
import org.objectweb.asm.tree.LookupSwitchInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.TableSwitchInsnNode;

/**
 * Factory for all JaCoCo filters.
 *
 * Trustroots build-time extension of the v0.8.15 upstream factory. Standard
 * filters are preserved and run through a tracker that records branch nodes
 * they already changed; the audited Trustroots filter runs last and avoids
 * counting those same nodes again.
 * Source: https://github.com/jacoco/jacoco/blob/v0.8.15/org.jacoco.core/src/org/jacoco/core/internal/analysis/filter/Filters.java
 */
public final class Filters {

	/**
	 * Descriptor of annotation present in all class files produced by the
	 * Kotlin compiler.
	 *
	 * @see <a href=
	 *      "https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-metadata/">documentation
	 *      of kotlin.Metadata annotation</a>
	 */
	public static final String KOTLIN_METADATA_DESC = "Lkotlin/Metadata;";

	private Filters() {
		// no instances
	}

	/**
	 * Filter that does nothing.
	 */
	public static final IFilter NONE = new FilterSet();

	/**
	 * Creates a filter that combines all filters.
	 *
	 * @return filter that combines all filters
	 */
	public static IFilter all() {
		final IFilter allCommonFilters = allCommonFilters();
		final IFilter allKotlinFilters = allKotlinFilters();
		final IFilter allNonKotlinFilters = allNonKotlinFilters();
		final IFilter trustrootsGeneratedCodeFilter = new TrustrootsGeneratedCodeFilter();
		return new IFilter() {
			public void filter(final MethodNode methodNode,
					final IFilterContext context, final IFilterOutput output) {
				final TrackingFilterOutput trackingOutput = new TrackingFilterOutput(output);
				allCommonFilters.filter(methodNode, context, trackingOutput);
				if (isKotlinClass(context)) {
					allKotlinFilters.filter(methodNode, context, trackingOutput);
				} else {
					allNonKotlinFilters.filter(methodNode, context, trackingOutput);
				}
				trustrootsGeneratedCodeFilter.filter(methodNode, context, trackingOutput);
			}
		};
	}

	private static IFilter allCommonFilters() {
		return new FilterSet( //
				new SyntheticClassFilter(), //
				new EnumFilter(), //
				new BridgeFilter(), //
				new SynchronizedFilter(), //
				new TryWithResourcesJavac11Filter(), //
				new TryWithResourcesJavacFilter(), //
				new TryWithResourcesEcjFilter(), //
				new FinallyFilter(), //
				new PrivateEmptyNoArgConstructorFilter(), //
				new AssertFilter(), //
				new StringSwitchJavacFilter(), //
				new StringSwitchFilter(), //
				new EnumEmptyConstructorFilter(), //
				new RecordsFilter(), //
				new ExhaustiveSwitchFilter(), //
				new RecordPatternFilter(), //
				new AnnotationGeneratedFilter());
	}

	private static IFilter allNonKotlinFilters() {
		return new FilterSet( //
				new SyntheticFilter());
	}

	private static IFilter allKotlinFilters() {
		return new FilterSet( //
				new KotlinGeneratedFilter(), //
				new KotlinSyntheticAccessorsFilter(), //
				new KotlinSerializableFilter(), //
				new KotlinEnumFilter(), //
				new KotlinJvmOverloadsFilter(), //
				new KotlinJvmStaticFilter(), //
				new KotlinSafeCallOperatorFilter(), //
				new KotlinLateinitFilter(), //
				new KotlinWhenFilter(), //
				new KotlinWhenStringFilter(), //
				new KotlinUnsafeCastOperatorFilter(), //
				new KotlinNotNullOperatorFilter(), //
				new KotlinInlineClassFilter(), //
				new KotlinExposeBoxedFilter(), //
				new KotlinDefaultArgumentsFilter(), //
				new KotlinInlineFilter(), //
				new KotlinCoroutineFilter(), //
				new KotlinDefaultMethodsFilter(), //
				new KotlinComposeFilter());
	}

	/**
	 * Returns {@code true} if the class corresponding to this context has
	 * {@link #KOTLIN_METADATA_DESC kotlin.Metadata} annotation.
	 *
	 * @param context
	 *            context information
	 * @return {@code true} if the class corresponding to this context has
	 *         {@link #KOTLIN_METADATA_DESC kotlin.Metadata} annotation
	 */
	private static boolean isKotlinClass(final IFilterContext context) {
		return context.getClassAnnotations().contains(KOTLIN_METADATA_DESC);
	}

}

/** Tracks conditional branches already changed by upstream filters. */
final class TrackingFilterOutput implements IFilterOutput {
	private final IFilterOutput delegate;
	private final Set<AbstractInsnNode> filteredBranches = Collections.newSetFromMap(new IdentityHashMap<>());

	TrackingFilterOutput(final IFilterOutput delegate) {
		this.delegate = delegate;
	}

	boolean isBranchAlreadyFiltered(final AbstractInsnNode instruction) {
		return filteredBranches.contains(instruction);
	}

	@Override
	public void ignore(final AbstractInsnNode from, final AbstractInsnNode to) {
		for (AbstractInsnNode instruction = from; instruction != null; instruction = instruction.getNext()) {
			trackBranch(instruction);
			if (instruction == to) break;
		}
		delegate.ignore(from, to);
	}

	@Override
	public void merge(final AbstractInsnNode first, final AbstractInsnNode second) {
		trackBranch(first);
		trackBranch(second);
		delegate.merge(first, second);
	}

	@Override
	public void replaceBranches(final AbstractInsnNode source, final Replacements replacements) {
		trackBranch(source);
		delegate.replaceBranches(source, replacements);
	}

	private void trackBranch(final AbstractInsnNode instruction) {
		if (instruction == null) {
			return;
		}
		if ((instruction instanceof JumpInsnNode jump
				&& (jump.getOpcode() >= Opcodes.IFEQ && jump.getOpcode() <= Opcodes.IF_ACMPNE
						|| jump.getOpcode() == Opcodes.IFNULL || jump.getOpcode() == Opcodes.IFNONNULL))
				|| instruction instanceof TableSwitchInsnNode || instruction instanceof LookupSwitchInsnNode) {
			filteredBranches.add(instruction);
		}
	}
}
