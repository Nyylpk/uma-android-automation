package com.steve1316.uma_android_automation.bot.solver

/**
 * Public entry point for the Smart Race Solver.
 *
 * The solver is a pure function: given a [SolverState] it produces a [Schedule]. The wiring
 * layer in Racing.kt is responsible for constructing the state from settings and feeding the
 * resulting schedule to the existing race-execution path.
 *
 * Re-solving on race loss is handled by callers: build a fresh [SolverState] with the lost
 * epithet added to [SolverState.deadEpithets] and call [solve] again. Schedules are not
 * cached at this layer — caching belongs to the wiring layer where the lifetime is known.
 */
object SmartRaceSolver {

    /**
     * Computes the highest-scoring schedule achievable from [state]. Delegates to [Heuristic].
     *
     * @param state Immutable inputs. The search plans from `state.currentTurn` forward.
     * @param beamWidth Optional override for beam-search width. Defaults to
     *   [Heuristic.DEFAULT_BEAM_WIDTH]; widen for more thorough search at the cost of CPU.
     */
    fun solve(state: SolverState, beamWidth: Int = Heuristic.DEFAULT_BEAM_WIDTH): Schedule =
        Heuristic.search(state, beamWidth)
}
