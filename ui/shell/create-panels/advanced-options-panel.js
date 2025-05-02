/**
 * @file advanced-options-panel.ts
 * @copyright 2024, Firaxis Games
 * @description Displays advanced game options and player setup
 */
import { DropdownSelectionChangeEventName } from '/core/ui/components/fxs-dropdown.js';
import ContextManager from '/core/ui/context-manager/context-manager.js';
import ActionHandler from '/core/ui/input/action-handler.js';
import FocusManager from '/core/ui/input/focus-manager.js';
import NavTray from '/core/ui/navigation-tray/model-navigation-tray.js';
import { GetCivilizationData } from '/core/ui/shell/create-panels/age-civ-select-model.js';
import { CreateGameModel } from '/core/ui/shell/create-panels/create-game-model.js';
import { GameCreationPanelBase } from '/core/ui/shell/create-panels/game-creation-panel-base.js';
import { getLeaderData } from '/core/ui/shell/create-panels/leader-select-model.js';
import LeaderSelectModelManager from '/core/ui/shell/leader-select/leader-select-model-manager.js';
import { Audio } from '/core/ui/audio-base/audio-support.js';

// modded imports, todo, already importing from leader-select-model
import {getPlayerMementoData} from 'fs://game/slothoth-setup-improved/ui/shell/create-panels/leader-select-model-slothoth.js';
import { MustGetElement } from '/core/ui/utilities/utilities-dom.js';
import { PlayerRandomiser } from "fs://game/slothoth-setup-improved/ui/shell/civ-leader-randomiser.js";
const PARAMETERS = Database.query('config', 'select * from AdvancedParameters')  ?? [];
const STANDARD_PARAMETERS = PARAMETERS.filter(parameter => !parameter.Advanced).map(parameter => parameter.ParameterID);
const ADVANCED_PARAMETERS = PARAMETERS.filter(parameter => parameter.Advanced).map(parameter => parameter.ParameterID);
// modded end
/**
 * AdvancedOptionsPanel displays advanced game options and player setup.
 *
 * @fires CreatePanelAcceptedEvent - When the start game button is pressed
 */
class AdvancedOptionsPanel extends GameCreationPanelBase {
    constructor(root) {
        super(root);
        // We cache the last changed parameter in case we need to refocus that parameter after rebuilding options
        this.lastChangedParameter = '';
        this.gameSetupRevision = 0;
        this.leftArea = document.createElement("fxs-vslot");
        this.centerArea = document.createElement("fxs-frame");
        this.standardParamContainer = document.createElement("div");
        this.advancedParamContainer = document.createElement("div");
        this.playerConfigContainer = document.createElement("div");
        this.gameSetupPanel = document.createElement("fxs-vslot");
        this.playerSetupPanel = document.createElement("fxs-vslot");
        this.backButtons = [];
        this.startGameButtons = [];
        this.addPlayerButton = document.createElement("fxs-button");
        this.activePanel = this.gameSetupPanel;
        this.gameParamEles = [];
        this.leaderData = [];
        this.leaderOptions = [];
        this.civilizationData = [];
        this.civilizationOptions = [];
        this.mementoSlotEles = [];
        this.activePlayers = [];
        this.leaderMap = new Map();
        this.civMap = new Map();
        this.civilizationNonRandoms = []
        const ageType = GameSetup.findGameParameter('Age')?.value.value?.toString() ?? "";

        const ageDomainMap = new Map([["AGE_ANTIQUITY", 'AntiquityAgeCivilizations'],
                                                                ["AGE_EXPLORATION", 'ExplorationAgeCivilizations'],
                                                                ["AGE_MODERN", 'ModernAgeCivilizations']])
        this.ageCivString = ageDomainMap.get(ageType)                  // need to have it dynamic for different ages

    }
    onInitialize() {
        super.onInitialize();
        const fragment = document.createDocumentFragment();
        this.Root.classList.add("fullscreen", "flex", "flex-row");
        this.leftArea.classList.add("advanced-options-gutter-left", "w-84", "justify-end");
        fragment.appendChild(this.leftArea);
        this.createSaveLoadConfig();
        this.centerArea.setAttribute("override-styling", "flex-auto relative");
        fragment.appendChild(this.centerArea);

        this.randomiser = new PlayerRandomiser()

        this.createGameSetupPanel();
        this.createPlayerSetupPanel();
        this.showGameSetupPanel();
        const rightArea = document.createElement("div");
        rightArea.classList.add("advanced-options-gutter-right", "w-84");
        fragment.appendChild(rightArea);
        this.Root.appendChild(fragment);
        //enableOpenSound is kept false intentionally
        this.enableCloseSound = true;
        this.Root.setAttribute("data-audio-group-ref", "audio-advanced-options");

    }
    onAttach() {
        super.onAttach();
        const checkGameSetup = () => {
            if (this.Root.isConnected) {
                if (GameSetup.currentRevision != this.gameSetupRevision) {
                    this.refreshGameOptions();
                    this.gameSetupRevision = GameSetup.currentRevision;
                }
                window.requestAnimationFrame(checkGameSetup);
            }
        };
        window.requestAnimationFrame(checkGameSetup);
    }
    onDetach() {
        super.onDetach();
    }
    onReceiveFocus() {
        super.onReceiveFocus();
        // Wait for controls to be initialized before attempting focus
        waitForLayout(() => this.updateFocus());
        // modded
        this.updateMementoData();
        // modded end
        NavTray.clear();
        NavTray.addOrUpdateGenericBack();
        NavTray.addOrUpdateShellAction1(CreateGameModel.nextActionStartsGame ? "LOC_UI_SETUP_START_GAME" : "LOC_GENERIC_CONTINUE");
    }
    onLoseFocus() {
        NavTray.clear();
        super.onLoseFocus();
    }
    onNavigateInput(navigationEvent) {
        if (navigationEvent.detail.status != InputActionStatuses.FINISH) {
            return;
        }
        switch (navigationEvent.getDirection()) {
            case InputNavigationAction.PREVIOUS:
                this.showGameSetupPanel();
                navigationEvent.preventDefault();
                navigationEvent.stopImmediatePropagation();
                Audio.playSound("data-audio-activate", "game-creator");
                break;
            case InputNavigationAction.NEXT:
                this.showPlayerSetupPanel();
                navigationEvent.preventDefault();
                navigationEvent.stopImmediatePropagation();
                Audio.playSound("data-audio-activate", "game-creator");
                break;
            case InputNavigationAction.SHELL_NEXT:
                this.showSaveScreen();
                navigationEvent.preventDefault();
                navigationEvent.stopImmediatePropagation();
                break;
            case InputNavigationAction.SHELL_PREVIOUS:
                this.showLoadScreen();
                navigationEvent.preventDefault();
                navigationEvent.stopImmediatePropagation();
                break;
        }
    }
    onEngineInput(event) {
        super.onEngineInput(event);
        if (event.detail.status != InputActionStatuses.FINISH) {
            return;
        }
        if (event.detail.name === "shell-action-1") {
            CreateGameModel.showNextPanel();
            event.stopPropagation();
            event.preventDefault();
        }

        if (event.detail.name === "shell-action-2") {
            if (!(CreateGameModel.selectedLeader?.isLocked)) {
                this.showMementoEditor(0);
            }
            event.stopPropagation();
            event.preventDefault();
        }
    }
    onActiveDeviceTypeChanged() {
        super.onActiveDeviceTypeChanged();
        for (const backButton of this.backButtons) {
            backButton.classList.toggle("hidden", ActionHandler.isGamepadActive);
        }
        for (const startGameButton of this.startGameButtons) {
            startGameButton.classList.toggle("hidden", ActionHandler.isGamepadActive);
        }
    }
    resetToDefaults() {
        Configuration.editGame()?.reset(GameModeTypes.SINGLEPLAYER);
        waitForLayout(() => {
            this.refreshGameOptions();
            this.refreshPlayerOptions();
        });
    }
    removePlayer(playerId) {
        const playerConfig = Configuration.editPlayer(playerId);
        if (playerConfig) {
            playerConfig.setSlotStatus(SlotStatus.SS_CLOSED);
            this.refreshPlayerOptions();
            this.updateFocus();
        }
    }
    addPlayer() {
        const maxPlayers = Configuration.getMap().maxMajorPlayers;
        let unusedId = -1;
        for (let playerId = 0; playerId < maxPlayers; ++playerId) {
            const playerConfig = Configuration.getPlayer(playerId);
            if (playerConfig.slotStatus === SlotStatus.SS_CLOSED) {
                unusedId = playerId;
                break;
            }
        }
        if (unusedId !== -1) {
            Configuration.editPlayer(unusedId)?.setSlotStatus(SlotStatus.SS_COMPUTER);
            this.refreshPlayerOptions();
        }
    }
    showGameSetupPanel() {
        this.playerSetupPanel.remove();
        this.centerArea.appendChild(this.gameSetupPanel);
        this.activePanel = this.gameSetupPanel;
        this.updateFocus();
    }
    showPlayerSetupPanel() {
        this.gameSetupPanel.remove();
        this.centerArea.appendChild(this.playerSetupPanel);
        this.activePanel = this.playerSetupPanel;
        this.updateFocus();
    }
    updateFocus() {
        this.refreshPlayerOptions();
        this.refreshGameOptions();
        if (this.activePanel == this.gameSetupPanel && this.gameParamEles.length > 0) {
            FocusManager.setFocus(this.gameParamEles[0]);
        }
        else {
            FocusManager.setFocus(this.activePanel);
        }
    }
    showSaveScreen() {
        const opts = { "menu-type": "save_config", "save-type": SaveTypes.SINGLE_PLAYER };
        ContextManager.push("screen-save-load", { singleton: true, createMouseGuard: true, attributes: opts });
    }
    showLoadScreen() {
        const opts = { "menu-type": "load_config", "save-type": SaveTypes.SINGLE_PLAYER };
        ContextManager.push("screen-save-load", { singleton: true, createMouseGuard: true, attributes: opts });
    }
    createSaveLoadConfig() {
        const saveButton = document.createElement("fxs-button");
        saveButton.classList.add("advanced-options-side-button", "mx-8", "mb-4");
        saveButton.setAttribute("action-key", "inline-nav-shell-next");
        saveButton.setAttribute("caption", "LOC_UI_SAVE_CONFIG");
        saveButton.addEventListener("action-activate", this.showSaveScreen.bind(this));
        this.leftArea.appendChild(saveButton);
        const loadButton = document.createElement("fxs-button");
        loadButton.classList.add("advanced-options-side-button", "mx-8", "mb-20", "mt-2");
        loadButton.setAttribute("action-key", "inline-nav-shell-previous");
        loadButton.setAttribute("caption", "LOC_UI_LOAD_CONFIG");
        loadButton.addEventListener("action-activate", this.showLoadScreen.bind(this));
        this.leftArea.appendChild(loadButton);
    }
    createTopNav(selectedPanel) {
        const navControls = [
            {
                category: "LOC_ADVANCED_OPTIONS_GAME_SETTINGS",
                isActive: selectedPanel == this.gameSetupPanel,
                eventHandler: this.showGameSetupPanel.bind(this)
            },
            {
                category: "LOC_ADVANCED_OPTIONS_PLAYER_SETTINGS",
                isActive: selectedPanel == this.playerSetupPanel,
                eventHandler: this.showPlayerSetupPanel.bind(this)
            }
        ];
        const navControlEle = this.createNavControls(navControls);
        navControlEle.classList.remove("flex-auto", "my-8");
        navControlEle.classList.add("my-4");
        return navControlEle;
    }
    createBottomNav() {
        const footer = document.createElement("fxs-hslot");
        footer.classList.add("justify-center");
        const backButton = document.createElement("fxs-button");
        backButton.classList.add("m-2");
        backButton.setAttribute("caption", "LOC_GENERIC_BACK");
        backButton.addEventListener("action-activate", () => CreateGameModel.showPreviousPanel());
        backButton.classList.toggle("hidden", ActionHandler.isGamepadActive);
        this.backButtons.push(backButton);
        footer.appendChild(backButton);
        const resetDefaultsButton = document.createElement("fxs-button");
        resetDefaultsButton.classList.add("m-2");
        resetDefaultsButton.setAttribute("caption", "LOC_OPTIONS_RESET_TO_DEFAULTS");
        resetDefaultsButton.addEventListener("action-activate", this.resetToDefaults.bind(this));
        footer.appendChild(resetDefaultsButton);
        const startGameButton = document.createElement("fxs-button");
        startGameButton.classList.add("m-2");
        startGameButton.setAttribute("caption", "LOC_UI_SETUP_START_GAME");
        startGameButton.addEventListener("action-activate", () => CreateGameModel.startGame());
        startGameButton.classList.toggle("hidden", ActionHandler.isGamepadActive);
        this.startGameButtons.push(startGameButton);
        footer.appendChild(startGameButton);
        return footer;
    }
    createPlayerSetupPanel() {
        this.playerSetupPanel.classList.add("absolute", "inset-6", "flex", "flex-col", "items-center");
        const header = document.createElement("fxs-header");
        header.classList.add("font-title", "text-lg", "text-center", "uppercase");
        header.setAttribute("title", "LOC_ADVANCED_OPTIONS_ADVANCED");
        header.setAttribute("filigree-style", "none");
        this.playerSetupPanel.appendChild(header);
        this.playerSetupPanel.appendChild(this.createTopNav(this.playerSetupPanel));
        const scrollableContent = document.createElement("fxs-scrollable");
        scrollableContent.classList.add("flex-auto");
        this.playerSetupPanel.appendChild(scrollableContent);
        scrollableContent.appendChild(this.playerConfigContainer);
        this.generateLeaderInfo();
        this.refreshPlayerOptions();
        const spacer = document.createElement("div");
        spacer.classList.add("flex-auto");
        this.playerSetupPanel.appendChild(spacer);
        this.addPlayerButton.classList.add("min-w-128", "my-4");
        this.addPlayerButton.setAttribute("caption", "LOC_ADVANCED_OPTIONS_ADD_PLAYER");
        this.addPlayerButton.addEventListener("action-activate", this.addPlayer.bind(this));
        this.playerSetupPanel.appendChild(this.addPlayerButton);
        this.playerSetupPanel.appendChild(this.createBottomNav());
    }
    generateLeaderInfo() {
        this.leaderData = getLeaderData();
        for (const leader of this.leaderData) {
            if (!leader.isLocked && leader.isOwned) {
                const tooltip = `[STYLE:text-secondary][STYLE:font-title-lg]${Locale.compose(leader.name)}[/S][/S]
				${leader.tags ? `[N]${leader.tags.map(tag => `[B]${Locale.compose(tag)}[/B]`).join(', ')}` : ""}
				${leader.abilityText ? `[N]${Locale.compose(leader.abilityText)}` : ""}`;
                this.leaderOptions.push({
                    id: leader.leaderID,
                    label: leader.name,
                    iconURL: UI.getIconURL(leader.icon),
                    tooltip: tooltip
                });
            }
        }
    }
    generateCivInfo() {
        this.civilizationData = GetCivilizationData();
        this.civilizationOptions.length = 0;
        for (const civilization of this.civilizationData) {
            if (!civilization.isLocked && civilization.isOwned) {
                const tooltip = `
				[STYLE:text-secondary][STYLE:font-title-lg]${Locale.compose(civilization.name)}[/S][/S][N]
				${civilization.tags ? `[N][B]${Locale.compose(civilization.tags.join(", "))}[/B]` : ""}
				${civilization.abilityText ? `[N]${Locale.compose(civilization.abilityText)}` : ""}
				${civilization.bonuses ? `[N][STYLE:text-secondary][STYLE:font-title-base]${Locale.compose("LOC_CREATE_CIV_UNIQUE_BONUSES_SUBTITLE")}[/S][/S]
					[N]${civilization.bonuses.map((bonus) => `[B]${Locale.compose(bonus.title)}[/B] ${Locale.compose(bonus.description)}`).join("[N]")}` : ""}`;
                this.civilizationOptions.push({
                    id: civilization.civID,
                    label: civilization.name,
                    iconURL: civilization.icon,
                    tooltip: tooltip
                });
            }
        }
    }
    handleLeaderSelection(event, playerId) {
        const leader = this.leaderOptions[event.detail.selectedIndex];
        const gameConfig = Configuration.editGame();
        const playerConfig = Configuration.editPlayer(playerId);
        if (gameConfig && playerConfig) {
            GameSetup.setPlayerParameterValue(playerId, 'PlayerLeader', leader.id);
            if (playerId === GameContext.localPlayerID) {
                CreateGameModel.selectedLeader = this.leaderData[event.detail.selectedIndex];
                LeaderSelectModelManager.showLeaderModels(leader.id);
            }
        }
    }
    handleCivilizationSelection(event, playerId) {
        const civilization = this.civilizationOptions[event.detail.selectedIndex];
        const gameConfig = Configuration.editGame();
        const playerConfig = Configuration.editPlayer(playerId);
        if (gameConfig && playerConfig) {
            GameSetup.setPlayerParameterValue(playerId, 'PlayerCivilization', civilization.id);
            if (playerId === GameContext.localPlayerID) {
                CreateGameModel.selectedCiv = this.civilizationData[event.detail.selectedIndex];
            }
        }
    }
    refreshPlayerOptions() {
        this.generateCivInfo();
        while (this.playerConfigContainer.hasChildNodes()) {
            this.playerConfigContainer.removeChild(this.playerConfigContainer.childNodes[0]);
        }
        const maxPlayers = Configuration.getMap().maxMajorPlayers;
        this.activePlayers = [];
        for (let playerId = 0; playerId < maxPlayers; ++playerId) {
            const playerConfig = Configuration.getPlayer(playerId);
            if (playerConfig.slotStatus !== SlotStatus.SS_CLOSED) {
                this.activePlayers.push(playerConfig);                  // todo, we need to change to Maps since can have players index that miss values
            }
        }
        this.activePlayers.forEach((playerConfig, player_Id) => {
            const playerOptions = this.createPlayerOptions(playerConfig, this.activePlayers.length > 2, player_Id);
            this.playerConfigContainer.appendChild(playerOptions);
        })
        this.addPlayerButton.setAttribute("disabled", (this.activePlayers.length == maxPlayers).toString());

        this.randomiser.doResolve(true, false)
    }
    createPlayerOptions(playerConfig, includeDeleteButton, player_Id) {
        const playerOptions = document.createElement("fxs-hslot");
        playerOptions.setAttribute("ignore-prior-focus", "true");
        playerOptions.classList.add("items-center", "my-2", "mx-6");
        const playerId = document.createElement("div");
        playerId.innerHTML = Locale.toNumber(playerConfig.id + 1);
        playerId.classList.add("w-12", "m-2", "text-center", "text-base", "font-title");
        playerOptions.appendChild(playerId);
        const selections = document.createElement("div");
        selections.classList.add("flex", "flex-row", "flex-auto");
        playerOptions.appendChild(selections);

        // mod starts
        // todo. decide if i want to do leader attributes dynamically or not
        // to do this bit, I need to first setup the actual assignment of leaders under the hood.
        // which should happen prior in non-advanded settings
        /*

        const leaderAttributeSelection = document.createElement("icon-dropdown");
        leaderAttributeSelection.classList.add("mx-2", "w-1\\/2");
        leaderAttributeSelection.setAttribute("show-label-on-selected-item", "true");
        leaderAttributeSelection.setAttribute("show-icon-on-list-item", "true");
        leaderAttributeSelection.setAttribute("no-selection-caption", "LOC_LEADER_SELECT_TITLE");
        leaderAttributeSelection.componentCreatedEvent.on((dropdown) => dropdown.updateDropdownItems(this.leaderOptions));
        leaderAttributeSelection.setAttribute("selected-item-index", this.leaderOptions.findIndex(l => l.id == playerConfig.leaderTypeName).toString());
        leaderAttributeSelection.addEventListener("dropdown-selection-change", (event) => this.handleLeaderSelection(event, playerConfig.id));
        selections.appendChild(leaderAttributeSelection);

         */

        // mod ends

        const leaderSelection = document.createElement("icon-dropdown");
        leaderSelection.classList.add("mx-2", "w-1\\/2");
        leaderSelection.setAttribute("show-label-on-selected-item", true);
        leaderSelection.setAttribute("show-icon-on-list-item", true);
        leaderSelection.setAttribute("no-selection-caption", "LOC_LEADER_SELECT_TITLE");
        leaderSelection.setAttribute("data-icon", "");
        leaderSelection.componentCreatedEvent.on((dropdown) => dropdown.updateDropdownItems(this.leaderOptions));
        leaderSelection.setAttribute("selected-item-index", this.leaderOptions.findIndex(l => l.id == playerConfig.leaderTypeName).toString());
        leaderSelection.addEventListener("dropdown-selection-change", (event) => this.handleLeaderSelection(event, playerConfig.id));

        const cheese = leaderSelection.icon
        // MustGetElement(".dropdown__container", this.Root);
        const icon = leaderSelection.querySelector('.dropdown__containe');
        const drop_down_label = leaderSelection.querySelector('.dropdown__label');

        if (icon) icon.classList.add('hidden');
        if (drop_down_label) drop_down_label.classList.add('hidden');

        this.leaderMap[player_Id] = leaderSelection

        selections.appendChild(leaderSelection);

        const civilizationSelection = document.createElement("icon-dropdown");
        civilizationSelection.classList.add("mx-2", "w-1\\/2");
        civilizationSelection.setAttribute("show-label-on-selected-item", true);
        civilizationSelection.setAttribute("show-icon-on-list-item", true);
        civilizationSelection.setAttribute("no-selection-caption", "LOC_CIV_SELECT_TITLE");
        civilizationSelection.setAttribute("data-icon", "");
        civilizationSelection.componentCreatedEvent.on((dropdown) => dropdown.updateDropdownItems(this.civilizationOptions));
        civilizationSelection.setAttribute("selected-item-index", this.civilizationOptions.findIndex(l => l.id == playerConfig.civilizationTypeName).toString());
        civilizationSelection.addEventListener("dropdown-selection-change", (event) => this.handleCivilizationSelection(event, playerConfig.id));

        this.civMap[player_Id] = civilizationSelection

        selections.appendChild(civilizationSelection);

        // mod starts

        const mementoSlotsContainer = document.createElement("div");
        mementoSlotsContainer.classList.add("flex", "flex-row", "items-start", "justify-center");
        selections.appendChild(mementoSlotsContainer);
        for (const [slotIndex, mementoSlotData] of getPlayerMementoData(player_Id).entries()) {
            const mementoSlotEle = document.createElement("memento-slot");
            mementoSlotEle.componentCreatedEvent.on(component => component.slotData = mementoSlotData);
            mementoSlotEle.addEventListener("action-activate", this.showMementoEditor.bind(this, slotIndex, player_Id));
            this.mementoSlotEles.push(mementoSlotEle);
            mementoSlotsContainer.appendChild(mementoSlotEle);
        }

        const optionEle = document.createElement('fxs-checkbox');
        optionEle.classList.add('display-flex', "font-body-base");
        optionEle.setAttribute("tabindex", "-1");
        optionEle.setAttribute('selected', 'true');

        optionEle.setAttribute('data-parameter-id', 'Resolve random Civ');
        // optionEle.classList.add("w-96");

        const container = document.createElement('fxs-hslot');
        container.classList.add('advanced-options-setting-row', 'items-center', 'mx-24', 'my-2');
        const label = document.createElement('div');
        label.classList.add('flex', "flex-auto", 'justify-start', "font-body-base");
        label.setAttribute('data-l10n-id', 'Reveal:');
        container.appendChild(label);
        container.appendChild(optionEle);
        // selections.appendChild(container);

        // mod ends

        const deleteIcon = document.createElement("fxs-activatable");
        deleteIcon.setAttribute("tabindex", "-1");
        deleteIcon.classList.add("close-button__bg", "group", "relative", "m-2", "w-8", "h-8");
        deleteIcon.classList.toggle("invisible", playerConfig.id === GameContext.localPlayerID || !includeDeleteButton);
        deleteIcon.addEventListener("action-activate", () => this.removePlayer(playerConfig.id));
        playerOptions.appendChild(deleteIcon);
        const border = document.createElement("div");
        border.classList.add("absolute", "inset-0\\.5", "img-dropdown-box-focus", "opacity-0", "transition-opacity", "group-hover\\:opacity-100", "group-focus\\:opacity-100");
        deleteIcon.appendChild(border);
        return playerOptions;
    }
    createGameSetupPanel() {
        this.gameSetupPanel.classList.add("absolute", "inset-6", "flex", "flex-col");
        const header = document.createElement("fxs-header");
        header.classList.add("font-title", "text-lg", "text-center", "uppercase");
        header.setAttribute("title", "LOC_ADVANCED_OPTIONS_ADVANCED");
        header.setAttribute("filigree-style", "none");
        this.gameSetupPanel.appendChild(header);
        this.gameSetupPanel.appendChild(this.createTopNav(this.gameSetupPanel));
        const scrollableContent = document.createElement("fxs-scrollable");
        scrollableContent.classList.add("flex-auto");
        this.gameSetupPanel.appendChild(scrollableContent);
        const basicSettingsHeader = document.createElement("fxs-header");
        basicSettingsHeader.classList.add("font-title", "text-base", "uppercase");
        basicSettingsHeader.setAttribute("filigree-style", "small");
        basicSettingsHeader.setAttribute("title", "LOC_GROUPID_GAMEOPTIONS");
        scrollableContent.appendChild(basicSettingsHeader);
        this.standardParamContainer.classList.add("flex", "flex-col");
        scrollableContent.appendChild(this.standardParamContainer);
        const advancedSettingsHeader = document.createElement("fxs-header");
        advancedSettingsHeader.classList.add("font-title", "text-base", "uppercase");
        advancedSettingsHeader.setAttribute("filigree-style", "small");
        advancedSettingsHeader.setAttribute("title", "LOC_GROUPID_ADVANCEDOPTIONS");
        scrollableContent.appendChild(advancedSettingsHeader);
        this.advancedParamContainer.classList.add("flex", "flex-col");
        scrollableContent.appendChild(this.advancedParamContainer);
        this.gameSetupPanel.appendChild(this.createBottomNav());
    }
    refreshGameOptions() {
        // Remove old options
        for (const element of this.gameParamEles) {
            element.remove();
        }
        this.gameParamEles.length = 0;
        // Create new options
        const standardFragment = document.createDocumentFragment();
        const advancedFragment = document.createDocumentFragment();
        let focusEle = null;
        for (const setupParam of GameSetup.getGameParameters()) {
            if (!setupParam.hidden && setupParam.invalidReason == GameSetupParameterInvalidReason.Valid) {
                const idString = GameSetup.resolveString(setupParam.ID);
                // Determine if the parameter is standard, advanced or should not be shown
                const isStandard = STANDARD_PARAMETERS.some(param => param == idString);
                if (!isStandard && !ADVANCED_PARAMETERS.some(param => param == idString)) {
                    continue;
                }
                const paramEle = this.createOption(setupParam);
                if (paramEle) {
                    this.createParamEleLabel(setupParam, paramEle, isStandard ? standardFragment : advancedFragment);
                    if (this.lastChangedParameter != '' && this.lastChangedParameter == idString) {
                        focusEle = paramEle;
                    }
                }
            }
        }
        // Append new options to DOM
        this.standardParamContainer.appendChild(standardFragment);
        this.advancedParamContainer.appendChild(advancedFragment);
        const currentFocus = FocusManager.getFocus();
        if (currentFocus.isConnected == false && focusEle) {
            // Only focus a new element if the previous focus was disconnected/removed
            FocusManager.setFocus(focusEle);
        }
    }
    createOption(setupParam) {
        let paramEle = null;
        if (setupParam.readOnly) {
            paramEle = this.createLabelOption(setupParam);
        }
        else {
            switch (setupParam.domain.type) {
                case GameSetupDomainType.Select:
                    paramEle = this.createSelectorOption(setupParam);
                    break;
                case GameSetupDomainType.Boolean:
                    paramEle = this.createBooleanOption(setupParam);
                    break;
                case GameSetupDomainType.Integer:
                case GameSetupDomainType.UnsignedInteger:
                    paramEle = this.createNumericOption(setupParam);
                    break;
                default:
                    paramEle = this.createLabelOption(setupParam);
                    break;
            }
        }
        if (paramEle) {
            this.setCommonInfo(setupParam, paramEle);
        }
        return paramEle;
    }
    setCommonInfo(setupParam, paramEle) {
        const description = GameSetup.resolveString(setupParam.description);
        if (description) {
            paramEle.setAttribute('data-tooltip-content', description);
        }
        const parameterID = GameSetup.resolveString(setupParam.ID);
        if (parameterID) {
            paramEle.setAttribute('data-parameter-id', parameterID);
        }
        paramEle.classList.add("w-96");
    }
    getValueName(setupParam) {
        return (setupParam.value.name
            ? GameSetup.resolveString(setupParam.value.name)
            : setupParam.value.value?.toString());
    }
    createParamEleLabel(setupParam, paramEle, fragment) {
        const paramName = GameSetup.resolveString(setupParam.name);
        const container = document.createElement('fxs-hslot');
        container.classList.add('advanced-options-setting-row', 'items-center', 'mx-24', 'my-2');
        const label = document.createElement('div');
        label.classList.add('flex', "flex-auto", 'justify-start', "font-body-base");
        label.setAttribute('data-l10n-id', `{${paramName}}:`);
        container.appendChild(label);
        container.appendChild(paramEle);
        this.gameParamEles.push(container);
        fragment.appendChild(container);
    }
    createSelectorOption(setupParam) {
        const selector = document.createElement('fxs-selector');
        const paramName = GameSetup.resolveString(setupParam.name);
        selector.classList.add("text-base");
        selector.setAttribute("tabindex", "-1");
        selector.setAttribute('label', paramName ?? "");
        selector.setAttribute("enable-shell-nav", "false");
        selector.setAttribute("direct-edit", "true");
        selector.addEventListener(DropdownSelectionChangeEventName, (event) => {
            const targetElement = event.target;
            const parameterID = targetElement.getAttribute('data-parameter-id');
            if (parameterID) {
                const index = event.detail.selectedIndex;
                const parameter = GameSetup.findGameParameter(parameterID);
                if (parameter && parameter.domain.possibleValues && parameter.domain.possibleValues.length > index) {
                    const value = parameter.domain.possibleValues[index];
                    this.lastChangedParameter = parameterID;
                    GameSetup.setGameParameterValue(parameterID, value.value);
                    this.refreshPlayerOptions();
                }
            }
        });
        const actionsList = [];
        if (setupParam.domain.possibleValues) {
            for (const [index, pv] of setupParam.domain.possibleValues.entries()) {
                const valueName = GameSetup.resolveString(pv.name);
                if (!valueName) {
                    console.error(`game-setup.ts - Failed to resolve string for game option: ${pv.name}`);
                    continue;
                }
                if (setupParam.value.value == pv.value) {
                    selector.setAttribute('selected-item-index', index.toString());
                }
                actionsList.push({ label: Locale.compose(valueName) });
            }
        }
        selector.setAttribute('dropdown-items', JSON.stringify(actionsList));
        return selector;
    }
    createBooleanOption(setupParam) {
        const optionEle = document.createElement('fxs-checkbox');
        const parameterID = GameSetup.resolveString(setupParam.ID);
        optionEle.classList.add('display-flex', "font-body-base");
        optionEle.setAttribute("tabindex", "-1");
        optionEle.setAttribute('selected', this.getValueName(setupParam));
        optionEle.addEventListener("component-value-changed", (event) => {
            const newValue = event.detail.value;
            const parameter = GameSetup.findGameParameter(parameterID);
            if (parameter) {
                GameSetup.setGameParameterValue(parameterID, newValue);
                this.refreshPlayerOptions();
            }
        });
        return optionEle;
    }
    createNumericOption(setupParam) {
        const optionEle = document.createElement('fxs-textbox');
        const parameterID = GameSetup.resolveString(setupParam.ID);
        optionEle.classList.add('display-flex', "font-body-base");
        optionEle.setAttribute("tabindex", "-1");
        optionEle.setAttribute('value', this.getValueName(setupParam));
        optionEle.addEventListener("component-value-changed", (event) => {
            const newValue = event.detail.value.toString();
            const parameter = GameSetup.findGameParameter(parameterID);
            if (parameter) {
                if (parameter.domain.type != GameSetupDomainType.Text) {
                    const numericValue = Number.parseInt(newValue);
                    if (numericValue) {
                        GameSetup.setGameParameterValue(parameterID, numericValue);
                    }
                }
                else {
                    GameSetup.setGameParameterValue(parameterID, newValue);
                }
            }
        });
        return optionEle;
    }
    createLabelOption(setupParam) {
        const optionEle = document.createElement('div');
        optionEle.classList.add("font-body-base");
        optionEle.setAttribute('data-l10n-id', this.getValueName(setupParam));
        return optionEle;
    }

    // modded functions
    showMementoEditor(slotIndex, playerId) {
        ContextManager.push("ai-memento-editor", { singleton: true, createMouseGuard: true, panelOptions: { slotIndex, playerId} });
    }

    updateMementoData() {
        this.activePlayers.forEach((playerConfig, player_Id) => {
            for (const [index, mementoSlotData] of getPlayerMementoData(player_Id).entries()) {
                const mementoComponent = this.mementoSlotEles[index]?.maybeComponent;
                if (mementoComponent) {
                    mementoComponent.slotData = mementoSlotData;
                }
            }
        })

    }

    getLeadersInfo() {
        const leaderItemData = Database.query('config', 'select * from Leaders') ?? [];
        const personaLeaders = [];

        const LeaderTypeValues = new Set(leaderItemData.map(item => item.LeaderType));

        // Need to get all personas so they aren't together in the same game
        for (const item of leaderItemData) {
            const altValue = item.LeaderType + '_ALT';

            if (LeaderTypeValues.has(altValue)) {
              personaLeaders.push(item);
            }
        }
        // need to also return personaLeaders

        const leaderCivBiases = Database.query('config', `select * from LeaderCivilizationBias WHERE CivilizationDomain='${this.ageCivString}'`) ?? [];

        this.leaderToCivsMap = new Map();

        // Iterate through each element in the array
        for (const element of leaderCivBiases) {
            const { leader, civ } = element;

            // Check if this leader is already in our map
            if (this.leaderToCivsMap.has(leader)) {
              // If yes, add this civ to the leader's array
              this.leaderToCivsMap.get(leader).push(civ);
            } else {
              // If no, create a new array with this civ
              this.leaderToCivsMap.set(leader, [civ]);
            }
          }
        return leaderItemData
    }



    leaderCivBiasSelection(leaderType, civBiasMap, exclusiveCivs) {
        const civBiases = civBiasMap[leaderType]
        const shuffledList = [...civBiases];                // do i need to reshuffle every time? maybe, as list shrinks in size
        // Shuffle the list using Fisher-Yates algorithm
        for (let i = shuffledList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledList[i], shuffledList[j]] = [shuffledList[j], shuffledList[i]];
        }
        for (const item of shuffledList) {
            if (exclusiveCivs.includes(item)) {
              return item;
            }
        }
    }

    civSelectionNoExclusivity(civList) {
        const randomIndex = Math.floor(Math.random() * civList.length);
        return civList[randomIndex]
    }

    // modded functions end
}
Controls.define('advanced-options-panel', {
    createInstance: AdvancedOptionsPanel,
    description: 'Displays advanced game options and player setup',
    styles: ['fs://game/core/ui/shell/create-panels/advanced-options-panel.css'],
    tabIndex: -1
});

//# sourceMappingURL=file:///core/ui/shell/create-panels/advanced-options-panel.js.map
