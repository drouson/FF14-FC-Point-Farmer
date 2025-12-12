const https = require('https');

// Test compound query for XIVAPI v2
const url = "https://v2.xivapi.com/api/search?sheets=Item&query=LevelItem>=550+IsUntradable=0&fields=Name,IsUntradable&limit=5";

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log(data);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
