const BASE_URL = 'https://v2.xivapi.com/api';

/**
 * Searches for tradeable, green/blue items above a certain ilvl.
 * @param {number} minIlvl 
 */
export async function searchTurningItems(minIlvl) {
    minIlvl = parseInt(minIlvl);
    console.log(`Searching for items >= ${minIlvl} via XIVAPI v2 (Tiered Strategy)...`);

    // Tiered Query Strategy to ensure diversity
    // If we just ask for >= 430, we get 250 level 430 items.
    // We split into 3 ranges:
    // 1. Low: minIlvl to minIlvl + 60
    // 2. Mid: minIlvl + 61 to minIlvl + 150
    // 3. High: minIlvl + 151 +
    
    let ranges = [];

    if (minIlvl <= 1) {
        // Broad Spectrum Search (All Expansions)
        ranges = [
            { min: 1, max: 150 },    // ARR + Early HW
            { min: 151, max: 400 },  // HW + SB
            { min: 401, max: 630 },  // ShB + EW
            { min: 631, max: 9999 }  // DT (Latest)
        ];
    } else {
        // Targeted Tiered Search
        ranges = [
            { min: minIlvl, max: minIlvl + 60 },
            { min: minIlvl + 61, max: minIlvl + 150 },
            { min: minIlvl + 151, max: 9999 }
        ];
    }

    const FIELDS = 'ID,Name,LevelItem,Icon,Rarity,IsUntradable,ItemSearchCategory,EquipSlotCategory';
    const limitPerTier = 200; // Increased to get more results

    try {
        const promises = ranges.map(range => {
            const query = `LevelItem>=${range.min}+LevelItem<=${range.max}+IsUntradable=0+Rarity>=2`;
            // Sorting Descending ensures we get the highest level (most valuable) items of each tier first.
            const url = `${BASE_URL}/search?sheets=Item&query=${query}&fields=${FIELDS}&limit=${limitPerTier}&sort=LevelItem&order=desc`;
            return fetch(url).then(res => res.json()).catch(e => ({ results: [] }));
        });

        const results = await Promise.all(promises);
        
        // Flatten results
        const allRawItems = results.flatMap(r => r.results || []);

        // Deduplicate (just in case)
        const uniqueItems = new Map();
        allRawItems.forEach(item => uniqueItems.set(item.row_id, item));

        const validItems = Array.from(uniqueItems.values()).map(item => {
            const props = item.fields || item;
            
            // Handle LevelItem being an object { value: 640, ... }
            let ilvl = props.LevelItem;
            if (ilvl && typeof ilvl === 'object') {
                ilvl = ilvl.value;
            }

            // Handle Icon
            let iconPath = '';
            if (props.Icon) {
                const rawPath = typeof props.Icon === 'object' ? (props.Icon.path_hr1 || props.Icon.path) : props.Icon;
                if (rawPath) {
                    iconPath = rawPath.replace('ui/icon', '/i').replace('.tex', '.png');
                }
            }

            return {
                ID: item.row_id,
                Name: props.Name,
                LevelItem: ilvl,
                Icon: iconPath,
                Rarity: props.Rarity,
                IsUntradable: props.IsUntradable,
                Category: props.ItemSearchCategory,
                EquipSlot: props.EquipSlotCategory
            };
        }).filter(item => {
            // Client-side filtering
            if (item.Rarity < 2) return false;
            // Explicitly exclude Skybuilders' items (Ishgard Restoration turn-ins, not GC)
            if (item.Name.includes("Skybuilders'")) return false;

            if (item.IsUntradable === 1 || item.IsUntradable === true) return false;
            
            // MUST be equipment to be turned in for Expert Delivery
            // If EquipSlotCategory is missing or null, it's a material/consumable.
            // Also check if it's an empty object (some APIs return {id:0} for none)
            if (!item.EquipSlot) return false;
            if (typeof item.EquipSlot === 'object' && item.EquipSlot.id === undefined) return false; // Safety

            if (!item.Category || item.Category.id < 1) return false;
            return true;
        });
        
        return validItems;

    } catch (error) {
        console.error('Failed to items:', error);
        return [];
    }
}


