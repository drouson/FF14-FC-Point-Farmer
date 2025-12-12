export const CURATED_ITEMS = [
    // --- Diadochos (Ilvl 640) ---
    { ID: 39700, Name: "Diadochos Ring of Fending", LevelItem: 640, Icon: "/i/063000/063945.png" },
    { ID: 39701, Name: "Diadochos Ring of Slaying", LevelItem: 640, Icon: "/i/063000/063944.png" },
    { ID: 39702, Name: "Diadochos Ring of Aiming", LevelItem: 640, Icon: "/i/063000/063943.png" },
    { ID: 39703, Name: "Diadochos Ring of Healing", LevelItem: 640, Icon: "/i/063000/063942.png" },
    { ID: 39704, Name: "Diadochos Ring of Casting", LevelItem: 640, Icon: "/i/063000/063941.png" },
    
    { ID: 39695, Name: "Diadochos Earring of Fending", LevelItem: 640, Icon: "/i/063000/063935.png" }, // Educated guess on Icon/ID calc
    { ID: 39696, Name: "Diadochos Earring of Slaying", LevelItem: 640, Icon: "/i/063000/063934.png" },
    { ID: 39697, Name: "Diadochos Earring of Aiming", LevelItem: 640, Icon: "/i/063000/063933.png" },
    { ID: 39698, Name: "Diadochos Earring of Healing", LevelItem: 640, Icon: "/i/063000/063932.png" },
    { ID: 39699, Name: "Diadochos Earring of Casting", LevelItem: 640, Icon: "/i/063000/063931.png" },

    // --- Archeo Kingdom (Ilvl 710) ---
    { ID: 42942, Name: "Archeo Kingdom Ring of Fending", LevelItem: 710, Icon: "/i/063000/063945.png" }, // Check Icon
    { ID: 42943, Name: "Archeo Kingdom Ring of Slaying", LevelItem: 710, Icon: "/i/063000/063944.png" },
    { ID: 42944, Name: "Archeo Kingdom Ring of Aiming", LevelItem: 710, Icon: "/i/063000/063943.png" },
    { ID: 42945, Name: "Archeo Kingdom Ring of Healing", LevelItem: 710, Icon: "/i/063000/063942.png" },
    { ID: 42946, Name: "Archeo Kingdom Ring of Casting", LevelItem: 710, Icon: "/i/063000/063941.png" },
    
    // Additional items can be added here
];

/**
 * Filter curated items by ilvl.
 */
export function getCuratedItems(minIlvl) {
    return CURATED_ITEMS.filter(item => item.LevelItem >= minIlvl);
}
