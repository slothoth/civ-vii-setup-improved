import { PlayerRandomiser } from "fs://game/slothoth-setup-improved/ui/shell/civ-leader-randomiser.js";

export class AgeTransitionCivSelectDecorator {
    constructor(val) {
        this.obj = val;
        this.wrapFunctions();
    }

    wrapFunctions() {
        const startGameFunc = this.obj.startGame?.bind(this.obj);
        if (startGameFunc) {
            this.obj.startGame = (...args) => {
                this.beforeStartGame(args);
                return startGameFunc(...args);
            };
        }
    }

    beforeStartGame(){
        if (!this.obj.selectedCivInfo || this.obj.selectedCivInfo?.isLocked) {
            return;
        }
        GameSetup.setPlayerParameterValue(GameContext.localPlayerID, 'PlayerCivilization', this.obj.selectedCivInfo.civID);
        const randomiser = new PlayerRandomiser()
        randomiser.doResolve(true, true)
    }

    replaceStartGame(){

    }

    beforeAttach() {
    }

    afterAttach() {
    }

    beforeDetach() { }

    afterDetach() { }

    onAttributeChanged(name, prev, next) { }
}

Controls.decorate('age-transition-civ-select', (val) => new AgeTransitionCivSelectDecorator(val));