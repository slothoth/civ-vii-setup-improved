import {getPlayerMementoData} from 'fs://game/slothoth-setup-improved/ui/shell/create-panels/leader-select-model-slothoth.js';
import { PlayerRandomiser } from "fs://game/slothoth-setup-improved/ui/shell/civ-leader-randomiser.js";

import { CreateGameModel } from '/core/ui/shell/create-panels/create-game-model.js';

import ContextManager from '/core/ui/context-manager/context-manager.js';

export class AdvancedOptionsPanelDecorator {
    constructor(val) {
        this.do_mementos = false
        this.obj = val;
        // modded
        this.obj.mementoSlotEles = [];
        this.obj.activePlayers = [];
        this.obj.leaderMap = new Map();
        this.obj.civMap = new Map();
        this.obj.civilizationNonRandoms = []
        const ageType = GameSetup.findGameParameter('Age')?.value.value?.toString() ?? "";

        const ageDomainMap = new Map([["AGE_ANTIQUITY", 'AntiquityAgeCivilizations'],
                                                                ["AGE_EXPLORATION", 'ExplorationAgeCivilizations'],
                                                                ["AGE_MODERN", 'ModernAgeCivilizations']])
        this.obj.ageCivString = ageDomainMap.get(ageType)                  // need to have it dynamic for different ages
        this.obj.randomiser = new PlayerRandomiser()        // bodge job setting up the randomiser here, but
        this.wrapFunctions();
    }

    wrapFunctions() {
        const createPlayerOptFunc = this.obj.createPlayerOptions?.bind(this.obj);
        if (createPlayerOptFunc) {
            this.obj.createPlayerOptions = (...args) => {
                const playerOptions = createPlayerOptFunc(...args);
                this.afterCreatePlayerOptions(args, playerOptions);
                return playerOptions;
            };
        }

        const onRecieveFocusFunc = this.obj.onReceiveFocus?.bind(this.obj);
        if (onRecieveFocusFunc) {
            this.obj.onReceiveFocus = (...args) => {
                const playerOptions = onRecieveFocusFunc(...args);
                this.afterRecieveFocus(args, playerOptions);
                return playerOptions;
            };
        }

        const onEngineInput = this.obj.onEngineInput?.bind(this.obj);
        if (onEngineInput) {
            this.obj.onEngineInput = (...args) => {
                const playerOptions = onEngineInput(...args);
                this.afterEngineInput(args, playerOptions);
                return playerOptions;
            };
        }
    }

    afterCreatePlayerOptions(args, result){
        const playerConfig = args[0]
        const playerIndex = args[2]
        const selections = result.querySelector('div.flex.flex-row.flex-auto');

        const playerLeaderParameter = GameSetup.findPlayerParameter(playerConfig.id, 'PlayerLeader');
        if (playerLeaderParameter) {
            let activeParameters = this.obj.activePlayerParameters.get(playerConfig.id);
            const activeParameterOptions = activeParameters.get(playerLeaderParameter.ID);
            this.obj.leaderMap[playerIndex] = activeParameterOptions[activeParameterOptions.length-1]
        }
        const playerCivParameter = GameSetup.findPlayerParameter(playerConfig.id, 'PlayerCivilization');
        if (playerCivParameter) {
            let activeParameters = this.obj.activePlayerParameters.get(playerConfig.id);
            const activeParameterOptions = activeParameters.get(playerCivParameter.ID);
            this.obj.civMap[playerIndex] = activeParameterOptions[activeParameterOptions.length-1]
        }
        const mementoSlotsContainer = document.createElement("div");
        mementoSlotsContainer.classList.add("flex", "flex-row", "items-start", "justify-center");
        selections.appendChild(mementoSlotsContainer);
        for (const [slotIndex, mementoSlotData] of getPlayerMementoData(playerIndex).entries()) {
            const mementoSlotEle = document.createElement("memento-slot");
            mementoSlotEle.componentCreatedEvent.on(component => component.slotData = mementoSlotData);
            mementoSlotEle.addEventListener("action-activate", this.showMementoEditor.bind(this, slotIndex, playerIndex));
            this.obj.mementoSlotEles.push(mementoSlotEle);
            mementoSlotsContainer.appendChild(mementoSlotEle);
        }
    }

    afterEngineInput(args, result){
        this.updateMementoData();
    }

    afterRecieveFocus(args, result){
        const ui_event = args[0]
        if (ui_event.detail.name === "shell-action-2") {
            if (!(CreateGameModel.selectedLeader?.isLocked)) {
                this.showMementoEditor(0);
            }
        }
    }

    // TODO: Refresh options on Advanced Parameter change allowing mementos
    // ALSO look into a version that hides the leader?
    afterRefreshPlayerOptions(){
        this.obj.randomiser.doResolve(true, false)
    }

    showMementoEditor(slotIndex, playerId) {
        ContextManager.push("ai-memento-editor", { singleton: true, createMouseGuard: true, panelOptions: { slotIndex, playerId} });
    }

    updateMementoData() {
        this.obj.activePlayers.forEach((playerConfig, player_Id) => {
            for (const [index, mementoSlotData] of getPlayerMementoData(player_Id).entries()) {
                const mementoComponent = this.obj.mementoSlotEles[index]?.maybeComponent;
                if (mementoComponent) {
                    mementoComponent.slotData = mementoSlotData;
                }
            }
        })
    }
    afterAttach() {
        const refreshPlayerOptions = this.obj.refreshPlayerOptions?.bind(this.obj);
        if (refreshPlayerOptions) {
            this.obj.refreshPlayerOptions = () => {
                refreshPlayerOptions();
                this.afterRefreshPlayerOptions();
            };
        }
    }

    beforeAttach() {}

    onAttributeChanged(name, prev, next) { }
}

Controls.decorate('advanced-options-panel', (val) => new AdvancedOptionsPanelDecorator(val));

