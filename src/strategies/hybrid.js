const { fetchAndStoreAutocompleteResults } = require('../utils/api');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/names.json');
const RATE_LIMIT = 100; // Max 100 requests per minute
const INTERVAL = 60000 / RATE_LIMIT; // 600ms delay per request
const MAX_EMPTY_RESPONSES = 10; // Stop after 10 consecutive empty responses
const MAX_RETRIES = 3; // Retry failed API calls up to 3 times
const BATCH_SIZE = 5; // Fetch multiple prefixes in parallel

class TrieNode {
    constructor() {
        this.children = {};
        this.isEndOfWord = false;
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word) {
        let node = this.root;
        for (const char of word) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.isEndOfWord = true;
    }

    contains(word) {
        let node = this.root;
        for (const char of word) {
            if (!node.children[char]) return false;
            node = node.children[char];
        }
        return node.isEndOfWord;
    }
}

// Ensure data folder exists
function ensureDataFolder() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Append results to `names.json` (reduces file I/O overhead)
function appendResults(data) {
    ensureDataFolder();
    const jsonData = JSON.stringify([...data], null, 2);
    fs.writeFileSync(DATA_FILE, jsonData, 'utf8');
}

// Function to fetch with retries
async function fetchWithRetries(prefix) {
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
        try {
            const results = await fetchAndStoreAutocompleteResults(prefix);
            if (results) return results;
        } catch (error) {
            logger.error(`Error fetching prefix "${prefix}" (attempt ${attempts + 1}): ${error.message}`);
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
    }
    return [];
}

async function hybridStrategy() {
    logger.info('Starting Hybrid strategy with Trie & Parallel Fetching...');

    if (fs.existsSync(DATA_FILE)) {
        fs.unlinkSync(DATA_FILE); // Delete existing data file
    }

    const trie = new Trie();
    const queue = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
    const names = new Set();
    let emptyResponses = 0; // Track consecutive empty API responses

    // Graceful shutdown handler
    let shutdown = false;
    process.on('SIGINT', () => {
        logger.warn('Graceful shutdown detected! Saving progress before exit...');
        appendResults(names);
        process.exit(0);
    });

    while (queue.length > 0) {
        if (shutdown) break; // Exit if shutdown requested

        // Fetch in parallel (BATCH_SIZE requests at a time)
        const batch = queue.splice(0, BATCH_SIZE);
        const resultsArray = await Promise.all(batch.map(fetchWithRetries));

        let hasNewResults = false;
        resultsArray.forEach((results, index) => {
            const prefix = batch[index];
            logger.info(`Fetched ${results.length} results for prefix: "${prefix}"`);

            if (Array.isArray(results) && results.length > 0) {
                emptyResponses = 0; // Reset empty response counter
                results.forEach(result => {
                    if (!names.has(result) && !trie.contains(result)) {
                        names.add(result);
                        trie.insert(result);
                        queue.push(result);
                        hasNewResults = true;
                    }
                });
            } else {
                emptyResponses++; // Increment empty response counter
                logger.warn(`No new results for prefix "${prefix}". Empty count: ${emptyResponses}`);
            }
        });

        // Save only if new results were found
        if (hasNewResults) {
            appendResults(names);
        }

        // Stop if the API keeps returning empty responses
        if (emptyResponses >= MAX_EMPTY_RESPONSES) {
            logger.warn(`API exhaustion detected! Stopping after ${emptyResponses} empty responses.`);
            break;
        }

        // **Rate Limiting**: Wait before making the next batch request
        if (queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, INTERVAL * BATCH_SIZE));
        }
    }

    logger.info(`Hybrid Strategy completed. Found ${names.size} names.`);
}

module.exports = hybridStrategy;
