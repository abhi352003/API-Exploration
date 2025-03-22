const { fetchAndStoreAutocompleteResults } = require('../utils/api');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/names.json');
const RATE_LIMIT = 100; // Max 100 requests per minute
const INTERVAL = 60000 / RATE_LIMIT; // 600ms delay per request
const MAX_EMPTY_RESPONSES = 10; // Stop after 10 consecutive empty responses

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

// Save results to `names.json`
function saveResults(data) {
    ensureDataFolder();
    fs.writeFileSync(DATA_FILE, JSON.stringify([...data], null, 2), 'utf8');
}

async function trieStrategy() {
    logger.info('Starting Trie strategy with rate limiting...');

    if (fs.existsSync(DATA_FILE)) {
        fs.unlinkSync(DATA_FILE); // Delete existing data file
    }

    const trie = new Trie();
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
                    if (!names.has(result) && !trie.contains(result)) {
                        names.add(result);
                        trie.insert(result);
                        queue.push(result);
                    }
                });

                // Save after each request to prevent data loss
                saveResults(names);
            } else {
                emptyResponses++; // Increment empty response counter
                logger.warn(`No new results for prefix "${prefix}". Empty count: ${emptyResponses}`);
            }

            // Stop if the API keeps returning empty responses
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

    logger.info(`Trie Strategy completed. Found ${names.size} names.`);
}

module.exports = trieStrategy;
