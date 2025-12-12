import { searchTurningItems } from './xivapi.js?v=2';
import { getMarketData } from './universalis.js';
import { TWO_TIER_DATA } from './worlds.js';

// DOM Elements
const regionSelect = document.getElementById('region-select');
const dcSelect = document.getElementById('dc-select');
const worldSelect = document.getElementById('world-select');
const minIlvlSelect = document.getElementById('min-ilvl');
const searchBtn = document.getElementById('search-btn');
const resultsTableBody = document.querySelector('#results-table tbody');
const statusMsg = document.getElementById('status-msg');
const favFilter = document.getElementById('fav-filter');

// State
let favorites = new Set(JSON.parse(localStorage.getItem('ff14-gc-favorites')) || []);
let lastResults = []; // Store results for re-rendering without API calls

function saveFavorites() {
    localStorage.setItem('ff14-gc-favorites', JSON.stringify([...favorites]));
}

// Init Selects
function initSelectors() {
    // Populate Regions
    Object.keys(TWO_TIER_DATA).forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
    });

    // Default Selection Logic
    regionSelect.addEventListener('change', () => populateDCs(regionSelect.value));
    dcSelect.addEventListener('change', () => populateWorlds(regionSelect.value, dcSelect.value));

    // Valid Default: Europe -> Light
    regionSelect.value = "Europe"; 
    populateDCs("Europe");
    dcSelect.value = "Light";
    populateWorlds("Europe", "Light");
}

function populateDCs(region) {
    dcSelect.innerHTML = '';
    const dcs = TWO_TIER_DATA[region];
    Object.keys(dcs).forEach(dc => {
        const option = document.createElement('option');
        option.value = dc;
        option.textContent = dc;
        dcSelect.appendChild(option);
    });
    // Trigger world update
    populateWorlds(region, dcSelect.value);
}

function populateWorlds(region, dc) {
    worldSelect.innerHTML = '<option value="all">Entire DC (Available)</option>';
    const worlds = TWO_TIER_DATA[region][dc];
    worlds.forEach(world => {
        const option = document.createElement('option');
        option.value = world;
        option.textContent = world;
        worldSelect.appendChild(option);
    });
}

// Start
initSelectors();

searchBtn.addEventListener('click', async () => {
    // Determine Target (DC or specific World)
    let target = worldSelect.value;
    if (target === 'all') {
        target = dcSelect.value; // Search entire DC
    }
    const server = target;
    
    if (!server) {
        setStatus('Please select a valid server or DC.', true);
        return;
    }

    const minIlvl = document.getElementById('min-ilvl').value;
    const minStock = parseInt(document.getElementById('min-stock').value, 10) || 1;
    const hqFilter = document.getElementById('hq-filter').value; // 'any', 'nq', 'hq'

    setStatusHTML(`
        <div style="display: flex; align-items: center; gap: 12px; font-weight: 500;">
            <span class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></span>
            <span>Scanning Sanctuary for items...</span>
        </div>
    `, false);
    clearTable();

    // 1. Find Candidates
    const candidates = await searchTurningItems(minIlvl);
    if (!candidates.length) {
        setStatus('No items found matching criteria.', true);
        return;
    }

    // 2. Fetch Market Data (Universalis)
    setStatusHTML(`
        <div style="display: flex; align-items: center; gap: 12px; font-weight: 400;">
            <span class="spinner" style="width: 20px; height: 20px; border-width: 2px; border-color: var(--accent); border-top-color: transparent;"></span>
            <span>Found <b style="color: var(--accent); font-size: 1.1em;">${candidates.length}</b> candidates. Fetching latest prices...</span>
        </div>
    `, false);
    
    // Show Progress Bar
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    const itemIds = candidates.map(i => i.ID);
    const marketData = await getMarketData(server, itemIds, 10, (percent) => {
        progressBar.style.width = `${percent}%`;
    });

    // Hide Progress Bar
    setTimeout(() => {
        progressContainer.classList.add('hidden');
    }, 500);

    // 3. Process & Sort
    const results = [];
    let stats = {
        candidates: candidates.length,
        noData: 0,
        noPrice: 0,
        hqMismatch: 0,
        lowStock: 0,
        lowFC: 0,
        lowEff: 0,
        notFav: 0
    };
    
    candidates.forEach(item => {
        const mData = marketData[item.ID];
        if (!mData || !mData.listings || mData.listings.length === 0) {
            stats.noData++;
            return;
        }

        // Valid listing?
        const listing = mData.listings[0];
        const minPrice = listing.pricePerUnit;
        if (!minPrice) {
            stats.noPrice++;
            return;
        }
        
        // HQ check
        const isHQ = listing.hq;
        
        // Filter Quality
        if (hqFilter === 'nq' && isHQ) { stats.hqMismatch++; return; }
        if (hqFilter === 'hq' && !isHQ) { stats.hqMismatch++; return; }

        // If searching DC, worldName is available. If single server, it might be omitted or present.
        // Fallback to the requested server name if not found in listing.
        const worldName = listing.worldName || server; 

        // Stock Logic
        // We need to calculate the "Relevant Stock" based on the user's HQ filter.
        // 'mData.unitsForSale' is the total of EVERYTHING (HQ + NQ). We can't use it blindly if filtering by HQ.
        
        let relevantStock = 0;
        
        // Sum up quantity of all listings that match our HQ filter
        // We relax the World check here because sometimes world filtering is too strict or data is missing.
        // We just want ensure we don't count NQ items if user wants HQ.
        relevantStock = mData.listings.reduce((sum, l) => {
            // Apply HQ Filter to stock count
            if (hqFilter === 'nq' && l.hq) return sum;
            if (hqFilter === 'hq' && !l.hq) return sum;
            
            // REMOVED strictly filtering by worldName here to prevent "0 results" errors.
            // If it's on the list, it's available in the region/DC we asked for.
            
            return sum + l.quantity;
        }, 0);

        // 2. Stock at the specific Min Price (Exact match)
        const stockAtPrice = mData.listings
            .filter(l => {
                if (l.pricePerUnit !== minPrice) return false;
                if (l.hq !== isHQ) return false;
                // If DC search, l.worldName exists. Ensure it matches the displayed world.
                if (l.worldName && l.worldName !== worldName) return false;
                return true;
            })
            .reduce((sum, l) => sum + l.quantity, 0);

        // Apply Stock Filter
        // Use 'relevantStock' (all items of matching quality on that world currently visible)
        // This is safer than 'unitsForSale' which might include filtered-out junk.
        if (relevantStock < minStock) {
            stats.lowStock++;
            return;
        }

        // Calculate Seals
        const seals = calculateSeals(item.LevelItem);

        // Calculate FC Points (Credits/XP)
        // Formula: iLvl * 1.5. Doubled for HQ.
        let fcPoints = Math.floor(item.LevelItem * 1.5);
        if (isHQ) {
            fcPoints *= 2;
        }

        // FC Points Filter
        const minFCPoints = parseInt(document.getElementById('min-fc-points').value, 10) || 0;
        if (fcPoints < minFCPoints) {
            stats.lowFC++;
            return;
        }

        // Efficiency
        const ratio = seals / minPrice;

        // Efficiency Filter
        const minEfficiency = parseFloat(document.getElementById('min-efficiency').value) || 0;
        if (ratio < minEfficiency) {
            stats.lowEff++;
            return;
        }

        // Favorites Filter
        const showFavOnly = favFilter.checked;
        const isFav = favorites.has(item.ID);
        if (showFavOnly && !isFav) {
            stats.notFav++;
            return;
        }

        results.push({
            name: item.Name,
            ilvl: item.LevelItem,
            price: minPrice,
            stock: stockAtPrice, // Display stock at this price
            totalStock: relevantStock, // Use refined filtered stock
            world: worldName,
            hq: isHQ,
            seals: seals,
            fcPoints: fcPoints,
            ratio: ratio,
            icon: item.Icon,
            id: item.ID
        });
    });

    // Sort by Efficiency (Desc) default
    results.sort((a, b) => b.ratio - a.ratio);
    
    // Store globally for sorting
    window.currentResults = results;
    window.sortDirection = { column: 'ratio', desc: true };

    renderResults(results);
    
    if (results.length === 0) {
        // Smart Error Message
        let reasons = [];
        if (stats.noData > 0) reasons.push(`${stats.noData} no market data`);
        if (stats.hqMismatch > 0) reasons.push(`${stats.hqMismatch} wrong quality`);
        if (stats.lowStock > 0) reasons.push(`<b>${stats.lowStock} low stock</b>`);
        if (stats.lowFC > 0) reasons.push(`<b>${stats.lowFC} low FC points</b>`);
        if (stats.lowEff > 0) reasons.push(`<b>${stats.lowEff} poor efficiency (< ${document.getElementById('min-efficiency').value})</b>`);
        if (stats.notFav > 0) reasons.push(`${stats.notFav} not in favorites`);
        
        let msg = `Found ${stats.candidates} items, but all were hidden:<br>` + reasons.join(', ');
        setStatusHTML(msg, true);
    } else {
        setStatus(`Found ${results.length} deal(s).`, false);
    }
});

// Sorting Logic
document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;
        const currentData = window.currentResults || [];
        if (currentData.length === 0) return;

        // Toggle direction
        if (window.sortDirection.column === column) {
            window.sortDirection.desc = !window.sortDirection.desc;
        } else {
            window.sortDirection = { column: column, desc: true }; // Default desc for new col
            // Exception: Name and World usually Asc
            if (column === 'name' || column === 'world') {
                window.sortDirection.desc = false;
            }
        }

        const desc = window.sortDirection.desc;

        currentData.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return desc ? 1 : -1;
            if (valA > valB) return desc ? -1 : 1;
            return 0;
        });

        renderResults(currentData);
    });
});


function calculateSeals(ilvl) {
    // Formula based on research
    if (ilvl > 660) {
        return Math.floor(ilvl + 1339); // Approx formula for 660+
    } else if (ilvl > 530) {
        return Math.ceil(1.6667 * ilvl + 895);
    } else if (ilvl > 400) {
        return Math.ceil(1.75 * ilvl + 850.5);
    } else if (ilvl > 290) {
        // Stormblood / Early Shadowbringers range approx
        return Math.floor(3.5 * ilvl);
    }
    // Fallback/Default low level (not efficient for farm but formula exists)
    return Math.floor(2.5 * ilvl); // Better fallback than just ilvl
}

function renderResults(data) {
    // ALWAYS clear table before rendering to prevent duplication (sorting bug fix)
    resultsTableBody.innerHTML = '';

    if (data.length === 0) {
        setStatus('No market listings found for these items.', true);
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        
        // Star / Fav Column
        const favTd = document.createElement('td');
        const favBtn = document.createElement('button');
        favBtn.className = 'fav-btn';
        favBtn.innerHTML = '★'; // Star symbol
        if (favorites.has(row.id)) {
            favBtn.classList.add('active');
        }
        
        favBtn.onclick = (e) => {
            e.stopPropagation(); // prevent row click if we add one later
            if (favorites.has(row.id)) {
                favorites.delete(row.id);
                favBtn.classList.remove('active');
            } else {
                favorites.add(row.id);
                favBtn.classList.add('active');
            }
            saveFavorites();
        };
        favTd.appendChild(favBtn);

        // Item Name & Icon
        const nameTd = document.createElement('td');
        
        // Link wrapper
        const itemLink = document.createElement('a');
        itemLink.href = `https://universalis.app/market/${row.id}`;
        itemLink.target = '_blank';
        itemLink.style.textDecoration = 'none';
        itemLink.style.color = 'inherit';
        itemLink.style.display = 'flex';
        itemLink.style.alignItems = 'center';
        itemLink.title = 'View full listings on Universalis';

        // Icon URL: https://xivapi.com
        const iconImg = document.createElement('img');
        iconImg.src = `https://xivapi.com${row.icon}`;
        iconImg.style.width = '32px';
        iconImg.style.verticalAlign = 'middle';
        iconImg.style.marginRight = '10px';
        iconImg.style.borderRadius = '4px';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = row.name;
        nameSpan.style.fontWeight = '500';
        nameSpan.className = 'item-name-link'; // For hover effect via CSS if needed, or inline
        
        // Inline hover effect
        itemLink.onmouseover = () => nameSpan.style.textDecoration = 'underline';
        itemLink.onmouseout = () => nameSpan.style.textDecoration = 'none';
        
        itemLink.appendChild(iconImg);
        itemLink.appendChild(nameSpan);
        
        nameTd.appendChild(itemLink);

        // Ilvl
        const ilvlTd = document.createElement('td');
        ilvlTd.textContent = row.ilvl;
        ilvlTd.className = 'val-ilvl';
        ilvlTd.dataset.label = 'iLvl';

        // World
        const worldTd = document.createElement('td');
        worldTd.textContent = row.world;
        worldTd.className = 'val-world';
        worldTd.dataset.label = 'World';

        // HQ
        const hqTd = document.createElement('td');
        hqTd.dataset.label = 'HQ';
        if (row.hq) {
             hqTd.innerHTML = '<span class="badge-hq">HQ</span>';
        } else {
             hqTd.textContent = '-';
             hqTd.className = 'val-nq';
        }

        // Price
        const priceTd = document.createElement('td');
        priceTd.textContent = row.price.toLocaleString() + ' g';
        priceTd.className = 'val-price';
        priceTd.dataset.label = 'Price';

        // Stock
        const stockTd = document.createElement('td');
        stockTd.dataset.label = 'Stock';
        if (row.stock === row.totalStock) {
             stockTd.textContent = row.stock.toLocaleString();
             stockTd.title = `${row.stock} available.`;
        } else {
             stockTd.textContent = `${row.stock}/${row.totalStock}`;
             stockTd.title = `${row.stock} at this price, ${row.totalStock} total.`;
        }
        stockTd.className = 'val-stock';

        // Seals
        const sealsTd = document.createElement('td');
        sealsTd.textContent = row.seals.toLocaleString();
        sealsTd.className = 'val-seals';
        sealsTd.dataset.label = 'Seals';

        // FC Points
        const fcTd = document.createElement('td');
        fcTd.textContent = row.fcPoints.toLocaleString();
        fcTd.className = 'val-fc';
        fcTd.dataset.label = 'FC Pts';
        if (row.hq) {
            fcTd.classList.add('is-hq');
            fcTd.title = 'Doubled due to HQ!';
        }

        // Efficiency
        const ratioTd = document.createElement('td');
        ratioTd.textContent = row.ratio.toFixed(2);
        ratioTd.className = 'val-eff';
        ratioTd.dataset.label = 'Efficiency';
        
        // Color code efficiency using classes
        if (row.ratio > 0.4) ratioTd.classList.add('eff-excellent');
        else if (row.ratio > 0.3) ratioTd.classList.add('eff-good');
        else ratioTd.classList.add('eff-bad');

        // Market Button (Universalis)
        const marketTd = document.createElement('td');
        marketTd.dataset.label = 'Market';
        const marketLink = document.createElement('a');
        marketLink.href = `https://universalis.app/market/${row.id}`;
        marketLink.target = '_blank';
        marketLink.className = 'icon-btn market-btn';
        marketLink.title = 'Open on Universalis';
        
        // Shopping Bag SVG
        marketLink.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1zm3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4h-3.5zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z"/>
        </svg>`;

        marketTd.appendChild(marketLink);

        // Copy Button
        const actionTd = document.createElement('td');
        actionTd.dataset.label = 'Action';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'icon-btn copy-btn';
        copyBtn.title = "Copy Item Name";
        // SVG Icon (Clipboard)
        copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
        `;
        
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(row.name);
            // Visual feedback
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="var(--success)" viewBox="0 0 16 16">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
            `;
            setTimeout(() => copyBtn.innerHTML = originalHTML, 1500);
        };
        
        actionTd.appendChild(copyBtn);

        tr.appendChild(favTd);
        tr.appendChild(nameTd);
        tr.appendChild(ilvlTd);
        tr.appendChild(worldTd);
        tr.appendChild(hqTd);
        tr.appendChild(priceTd);
        tr.appendChild(stockTd);
        tr.appendChild(sealsTd);
        tr.appendChild(fcTd);
        tr.appendChild(ratioTd);
        tr.appendChild(marketTd);
        tr.appendChild(actionTd);

        resultsTableBody.appendChild(tr);
    });
}

function setStatus(msg, isError) {
    statusMsg.textContent = msg;
    statusMsg.classList.remove('hidden');
    statusMsg.style.color = isError ? '#f85149' : 'var(--text-secondary)';
}

function setStatusHTML(html, isError) {
    statusMsg.innerHTML = html;
    statusMsg.classList.remove('hidden');
    statusMsg.style.color = isError ? '#f85149' : 'var(--text-secondary)';
}

function clearTable() {
    resultsTableBody.innerHTML = '';
}
