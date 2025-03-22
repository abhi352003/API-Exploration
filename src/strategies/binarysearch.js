const { fetchAndStoreAutocompleteResults } = require('../utils/api');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/names.json');
const RATE_LIMIT = 100; // Max 100 requests per minute
const INTERVAL = 60000 / RATE_LIMIT; // 600ms delay per request
const MAX_RETRIES = 3; // Retry failed API calls up to 3 times

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

async function binarySearchStrategy() {
    logger.info('Starting Binary Search strategy for optimized name extraction...');

    if (fs.existsSync(DATA_FILE)) {
        fs.unlinkSync(DATA_FILE); // Delete existing data file
    }

    const trie = new Trie();
    const names = new Set();
    const queue = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

    while (queue.length > 0) {
        const prefix = queue.shift();
        logger.info(`Fetching results for prefix: "${prefix}"`);

        try {
            const results = await fetchWithRetries(prefix);

            if (Array.isArray(results) && results.length > 0) {
                results.forEach(result => {
                    if (!names.has(result) && !trie.contains(result)) {
                        names.add(result);
                        trie.insert(result);

                        // **Binary Search Expansion**: Find midpoint and add to queue
                        const midIndex = Math.floor(result.length / 2);
                        const leftPrefix = result.substring(0, midIndex);
                        const rightPrefix = result.substring(0, midIndex + 1);

                        if (!trie.contains(leftPrefix)) queue.push(leftPrefix);
                        if (!trie.contains(rightPrefix)) queue.push(rightPrefix);
                    }
                });

                // Save only if new results were found
                saveResults(names);
            } else {
                logger.warn(`No results found for prefix "${prefix}", pruning search.`);
            }
        } catch (error) {
            logger.error(`Error fetching prefix "${prefix}": ${error.message}`);
        }

        // **Rate Limiting**: Wait before making the next request
        if (queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, INTERVAL));
        }
    }

    logger.info(`Binary Search Strategy completed. Found ${names.size} names.`);
}

module.exports = binarySearchStrategy;
