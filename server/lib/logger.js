const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const currentLevel = process.env.LOG_LEVEL ? levels[process.env.LOG_LEVEL.toLowerCase()] : levels.error;

// Default to error if invalid level provided
const activeLevel = currentLevel !== undefined ? currentLevel : levels.error;

const logger = {
    debug: (...args) => {
        if (activeLevel <= levels.debug) console.debug(...args);
    },
    info: (...args) => {
        if (activeLevel <= levels.info) console.log(...args);
    },
    log: (...args) => {
        if (activeLevel <= levels.info) console.log(...args);
    },
    warn: (...args) => {
        if (activeLevel <= levels.warn) console.warn(...args);
    },
    error: (...args) => {
        if (activeLevel <= levels.error) console.error(...args);
    }
};

export default logger;
