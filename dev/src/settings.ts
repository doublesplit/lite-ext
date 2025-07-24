import { Input, Option } from './Settings.entities';
import { Settings } from './Settngs';

enum Group1 {
    s_game = 'gameplayGroup'
}

const settingsDescriptions = {
    Minimap: new Option({ path: Group1.s_game, value: true }),
    AutoRespawn: new Option({ path: Group1.s_game, value: false }),
    LeaderboardTitle: new Input({ path: Group1.s_game, value: 'Doublesplit', options: { Leaderboard: 'Leaderboard' } }),
    MapBorder: new Option({ path: Group1.s_game, value: true }),
    MapSectors: new Option({ path: Group1.s_game, value: true }),
    MapSectorLabels: new Option({ path: Group1.s_game, value: true }),
    AutoCollectCoins: new Option({ path: Group1.s_game, value: true }),
    AcidMode: new Option({ path: Group1.s_game, value: false })

    // label: new Color({ path: Group1.s_game, value: 0x1affa3ff }),
    // miniblob: new Color({ path: Group1.s_game, value: 0x0000ffff }),
    // transparent_cells: new Slider({ path: Group1.s_game, value: 1, min: 0.1, max: 1, step: 0.1 })
};

export const settings = new Settings(settingsDescriptions);
Object.assign(window, { settings });
