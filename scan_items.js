const fetch = require('http'); // basic node fetch or just use https
const https = require('https');

const start = 40200;
const end = 40230;

function fetchItem(id) {
    return new Promise((resolve) => {
        https.get(`https://xivapi.com/Item/${id}?columns=ID,Name,LevelItem,Icon`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.Name && json.Name.includes('Diadochos')) {
                        console.log(JSON.stringify(json));
                    }
                    resolve();
                } catch (e) { resolve(); }
            });
        }).on('error', () => resolve());
    });
}

async function run() {
    console.log('Scanning...');
    for (let i = start; i < end; i++) {
        await fetchItem(i);
        // tiny delay to be nice
        await new Promise(r => setTimeout(r, 100));
    }
}

run();
