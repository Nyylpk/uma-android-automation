package com.steve1316.uma_android_automation.bot.solver

/**
 * Public entry point for the Smart Race Solver.
 *
 * The solver is a pure function: given a [SolverState] it produces a [Schedule]. The wiring
 * layer in Racing.kt is responsible for constructing the state from settings and feeding the
 * resulting schedule to the existing race-execution path.
 *
 * Two backends are available:
 *  - [MilpSolver] (default) — exact MILP via ojAlgo. Mirrors the reference Trackblazer
 *    site's GLPK formulation and produces optimal schedules.
 *  - [Heuristic] — original beam-search, retained as a fallback when MILP is infeasible
 *    (e.g., contradictory forced epithets) or for benchmarking.
 *
 * Re-solving on race loss is handled by callers: build a fresh [SolverState] with the lost
 * epithet added to [SolverState.deadEpithets] and call [solve] again.
 */
object SmartRaceSolver {
    /**
     * Computes the highest-scoring schedule achievable from [state]. Tries MILP first; falls
     * back to beam search if MILP returns an empty schedule (infeasible model).
     *
     * @param state Immutable inputs. The search plans from `state.currentTurn` forward.
     * @param beamWidth Beam width forwarded to the heuristic fallback only. Ignored by MILP.
     */
    fun solve(state: SolverState, beamWidth: Int = Heuristic.DEFAULT_BEAM_WIDTH): Schedule {
        val milp = MilpSolver.solve(state)
        if (milp.decisions.isEmpty()) return Heuristic.search(state, beamWidth)
        return milp
    }
}
