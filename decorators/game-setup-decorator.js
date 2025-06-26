import { PlayerRandomiser } from "fs://game/slothoth-setup-improved/ui/shell/civ-leader-randomiser.js";

export class GameSetupDecorator {
    constructor(val) {
        this.obj = val;
    }

    beforeAttach() {
    }

    afterAttach() {
        const randomiser = new PlayerRandomiser()
        randomiser.doResolve(true, false)
    }

    beforeDetach() { }

    afterDetach() { }

    onAttributeChanged(name, prev, next) { }
}

Controls.decorate('game-setup-panel', (val) => new GameSetupDecorator(val));
