package com.steve1316.uma_android_automation.bot.campaigns

import com.steve1316.uma_android_automation.bot.Campaign
import com.steve1316.uma_android_automation.bot.Game
import com.steve1316.uma_android_automation.bot.Training
import com.steve1316.uma_android_automation.types.DateYear

/**
 * Unity Cup-specific Training subclass that customizes scoring behavior.
 *
 * @property game The [Game] instance for interacting with the game state.
 * @property campaign The [Campaign] instance for accessing campaign state.
 */
class UnityCupTraining(game: Game, campaign: Campaign) : Training(game, campaign) {
    override fun getTrainingScoringMode(): String {
        return if (campaign.date.year < DateYear.SENIOR) {
            "Unity Cup (Spirit Gauge)"
        } else {
            super.getTrainingScoringMode()
        }
    }

    override fun scoreTraining(config: TrainingConfig, option: TrainingOption): Double {
        return if (campaign.date.year < DateYear.SENIOR) {
            scoreUnityCupTraining(config, option)
        } else {
            super.scoreTraining(config, option)
        }
    }
}
