package com.steve1316.uma_android_automation.bot.solver

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * React Native bridge for the Smart Race Solver. Exposes the solver to JS so the settings UI can
 * render an offline schedule preview without duplicating the beam-search algorithm in TypeScript.
 *
 * @property reactContext Injected by React Native's module loader.
 */
class SmartRaceSolverModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = MODULE_NAME

    /**
     * Computes a fresh-start schedule preview for the current solver configuration.
     *
     * @param configJson JSON snapshot of the user's settings (scenario, characterPreset, aptitudes,
     *   targetEpithets, forcedEpithets, manualLocks, weights). Built JS-side so the preview reflects
     *   unsaved UI state without waiting for a SQLite round-trip.
     * @param promise Resolves to a JSON string `{decisions, projectedEpithets, totalScore}` or rejects
     *   with an `E_SOLVER` error code on failure.
     */
    @ReactMethod
    fun previewSchedule(configJson: String, promise: Promise) {
        try {
            promise.resolve(SmartRaceSolverIntegration.previewSchedule(configJson))
        } catch (t: Throwable) {
            promise.reject("E_SOLVER", t.message ?: "preview failed", t)
        }
    }

    companion object {
        /** Name JS imports this module under via `NativeModules.SmartRaceSolverModule`. */
        private const val MODULE_NAME = "SmartRaceSolverModule"
    }
}
