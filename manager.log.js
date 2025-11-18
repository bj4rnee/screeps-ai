const COLORS = {
    info:   'color:#ffafff',
    warn:   'color:#ffaf00',
    error:  'color:#d70000',
    debug:  'color:#ff5fd7',
    market: 'color:#5fd7ff'
};

// build formatted log line
function format(level, msg, roomName = null) {
    const style = COLORS[level] || '';
    const roomTag = roomName ? `[${roomName}] ` : '';
    const prefix = `[${level.toUpperCase()}]`;

    return `<span style="${style}">${roomTag}${prefix} ${msg}</span>`;
}

module.exports = {
    info(msg, roomName = null) {
        console.log(format("info", msg, roomName));
    },

    warn(msg, roomName = null) {
        console.log(format("warn", msg, roomName));
    },

    error(msg, roomName = null) {
        console.log(format("error", msg, roomName));
    },

    debug(msg, roomName = null) {
        console.log(format("debug", msg, roomName));
    },

    market(msg, roomName = null) {
        console.log(format("market", msg, roomName));
    }
};