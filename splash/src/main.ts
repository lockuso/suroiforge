// mainfile for splash

import { Game } from "../../client/src/scripts/game";

export class Splash {
    game : any;

    constructor() {
        this.game = null;
    }

    bind(game : Game) {
        this.game = game;
    }
}

export var splash : Splash = new Splash();