const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const API_BASE_URL = 'http://35.200.185.69:8000';

const DATA_FILE = path.join(__dirname, '../../data/names.json');

// Counter for the number of searches
let searchCount = 0;

function ensureDataFolder() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function fetchAndStoreAutocompleteResults(query) {
    try {
        searchCount++;  // Increment search count for each API call
        const response = await axios.get(`${API_BASE_URL}/v1/autocomplete`, { params: { query } });

        // Ensure we only store the relevant results array
        const results = response.data.results || [];
        const resultsCount = results.length;  // Get the count of results

        // Log the number of searches and results
        logger.info(`Search #${searchCount} for query "${query}"`);
        logger.info(`Number of results in v1: ${resultsCount}`);

        // Delete existing file if it exists
        if (fs.existsSync(DATA_FILE)) {
            fs.unlinkSync(DATA_FILE);
            logger.info('Existing names.json deleted');
        }

        // Ensure the data folder exists
        ensureDataFolder();

        // Save new data
        fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2), 'utf8');
        logger.info('New autocomplete results saved to names.json');

        return results;
    } catch (error) {
        logger.error(`Error fetching or saving autocomplete results for query "${query}":`, error);
        return [];
    }
}

module.exports = { fetchAndStoreAutocompleteResults };
