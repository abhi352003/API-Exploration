const { fetchAndStoreAutocompleteResults } = require('../utils/api');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DATA_FILE = path.join(__dirname, '../../data/names.json');
const RATE_LIMIT = 100; // Max 100 requests per minute
const INTERVAL = 60000 / RATE_LIMIT; // 600ms delay per request
const MAX_EMPTY_RESPONSES = 10; // Stop if API returns empty results 10 times in a row

// Ensure data folder exists
function ensureDataFolder() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Save results to `names.json`
function saveResults(data) {
    ensureDataFolder();
    fs.writeFileSync(DATA_FILE, JSON.stringify([...data], null, 2), 'utf8');
}

async function bfsStrategy() {
    logger.info('Starting BFS strategy with rate limiting...');

    const queue = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
    const names = new Set();
    let emptyResponses = 0; // Track consecutive empty API responses

    while (queue.length > 0) {
        const prefix = queue.shift();
        logger.info(`Fetching results for prefix: "${prefix}"`);

        try {
            const results = await fetchAndStoreAutocompleteResults(prefix);

            if (Array.isArray(results) && results.length > 0) {
                emptyResponses = 0; // Reset empty response counter
                results.forEach(result => {
                    if (!names.has(result)) {
                        names.add(result);
                        queue.push(result);
                    }
                });
            } else {
                emptyResponses++; // Increment empty response counter
                logger.warn(`No new results for prefix "${prefix}". Empty count: ${emptyResponses}`);
            }

            // Save data after each request
            saveResults(names);

            // Stop if the API keeps returning empty results
            if (emptyResponses >= MAX_EMPTY_RESPONSES) {
                logger.warn(`API exhaustion detected! Stopping after ${emptyResponses} empty responses.`);
                break;
            }

        } catch (error) {
            logger.error(`Error fetching results for prefix "${prefix}": ${error.message}`);
        }

        // **Rate Limiting**: Wait before making the next request
        if (queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, INTERVAL));
        }
    }

    logger.info(`BFS Strategy completed. Found ${names.size} names.`);
}

module.exports = bfsStrategy;
