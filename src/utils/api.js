const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const API_BASE_URL = 'http://35.200.185.69:8000';

const DATA_FILE = path.join(__dirname, '../../data/names.json');

function ensureDataFolder() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function fetchAndStoreAutocompleteResults(query) {
    try {
        const response = await axios.get(`${API_BASE_URL}/v1/autocomplete`, { params: { query } });

        // Debugging: Log the API response
        logger.info(`API Response for "${query}":`, JSON.stringify(response.data, null, 2));

        // Ensure we only store the relevant results array
        const results = response.data.results || [];

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
