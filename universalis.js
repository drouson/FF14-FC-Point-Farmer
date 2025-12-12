/**
 * Universalis Client
 * Fetches market board prices.
 */

const BASE_URL = 'https://universalis.app/api/v2';

/**
 * Get cheapest listings for a list of items on a specific world/DC.
 * @param {string} worldOrDc - World name (e.g. "Ragnarok") or DC name (e.g. "Chaos").
 * @param {number[]} itemIds - Array of item IDs.
 */
export async function getMarketData(worldOrDC, itemIds, limit = 10, onProgress = null) {
    if (!itemIds.length) return {};

    // 1. Chunking
    // URL limit is typically ~2048 chars for safety.
    // 50 IDs * 6 chars + overhead < 500 chars. Very safe.
    const chunkSize = 50; 
    const chunks = [];
    
    for (let i = 0; i < itemIds.length; i += chunkSize) {
        chunks.push(itemIds.slice(i, i + chunkSize));
    }

    try {
        // 2. Sequential Fetching to avoid Rate Limiting (429)
        // Universalis can be sensitive to burst requests.
        const mergedItems = {};

        let itemsProcessed = 0;
        const totalChunks = chunks.length;

        for (let i = 0; i < totalChunks; i++) {
            const chunk = chunks[i];
            const idsString = chunk.join(',');
            const url = `${BASE_URL}/${worldOrDC}/${idsString}?listings=${limit}&entries=0`;

            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.warn(`Universalis request failed: ${res.status}`);
                } else {
                    const data = await res.json();
                    const itemsMap = data.items || (data.listings ? { [data.itemID]: data } : {});
                    Object.assign(mergedItems, itemsMap);
                }
                
                // Progress Update
                if (onProgress) {
                    const progress = Math.round(((i + 1) / totalChunks) * 100);
                    onProgress(progress);
                }
                
                // Small delay to be polite
                await new Promise(r => setTimeout(r, 50));

            } catch (chunkError) {
                console.error('Chunk fetch error:', chunkError);
            }
        }

        return mergedItems;

    } catch (error) {
        console.error('Fatal fetch error:', error);
        return {};
    }
}
