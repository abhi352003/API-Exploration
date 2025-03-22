const bfsStrategy = require('./strategies/bfs');
const trieStrategy = require('./strategies/trie');
const hybridStrategy = require('./strategies/hybrid');
const binarySearchStrategy = require('./strategies/binarysearch')
const logger = require('./utils/logger');

async function main() {
    logger.info('Starting autocomplete name extraction...');

    const strategy = 'bfs'; // Change this to best strategy
    switch (strategy) {
        case 'bfs':
            await bfsStrategy();
            break;
        case 'trie':
            await trieStrategy();
            break;
        case 'hybrid':
            await hybridStrategy();
            break;
        case 'binarysearch':
            await binarySearchStrategy();
            break;
        default:
            logger.error(`Unknown strategy: ${strategy}`);
            process.exit(1);
    }

    logger.info('Name extraction completed.');
}

// Handle errors gracefully
main().catch(err => logger.error('Error in main execution:', err));
