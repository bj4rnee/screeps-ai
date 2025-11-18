// WIP gamestaging with screep production control
// TODO invader failsave
// TODO room controller decay failsave

const roles = require('./roles');
const visuals = require('./manager.visuals');
const linkManager = require('./manager.link');
const log = require('./manager.log');
const { manageStage } = require('./manager.stage');
const {
    manageSpawns,
    spawnClaimer,
    spawnBootstrap,
    spawnScout,
    spawnSupporter
} = require('./manager.spawn');

var wall_max_hp = 20000000;
var rampart_max_hp = 10000000;
// market situation for shard 3
var market_prices = { "U": 70, "L": 15.4, "Z": 20.0, "H": 200, "O": 5.5, "K": 2.0, "X": 3.9, "energy": 18 };

// main game loop function
module.exports.loop = function () {

    // -------------------------------------
    // memory cleanup
    // -------------------------------------
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('[INFO] Cleared non-existing creep memory:', name);
        }
    }

    // -------------------------------------
    // generate pixel when bucket is full
    // -------------------------------------
    if (Game.cpu.bucket >= 10000) { Game.cpu.generatePixel() }

    // -------------------------------------
    // Handle all owned rooms dynamically
    // -------------------------------------
    var all_structures_in_room = {};

    for (let roomName in Game.rooms) {
        const curRoom = Game.rooms[roomName];

        // skip rooms i don't own (e.g. observer or neutral rooms)
        if (!curRoom.controller || !curRoom.controller.my) continue;

        if (!curRoom.memory.struct_ids) curRoom.memory.struct_ids = {};
        const ids = curRoom.memory.struct_ids;

        const spawn_list = curRoom.find(FIND_MY_SPAWNS);
        if (spawn_list.length < 1) continue;
        const main_spawn = spawn_list[0];

        if (!ids.main_spawn_id) ids.main_spawn_id = main_spawn.id;

        // find other structures (call only once per tick)
        const containers = curRoom.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_CONTAINER);
            }
        });

        const e_sources = curRoom.find(FIND_SOURCES); // energy sources
        const m_sources = curRoom.find(FIND_MINERALS, { filter: (m) => { return (m.mineralAmount > 0); } }); // active mineral sources

        const containers_by_source = curRoom.find(FIND_STRUCTURES, {
            filter: (structure) => {
                if (structure.structureType !== STRUCTURE_CONTAINER) return false;
                return e_sources.some(source => structure.pos.inRangeTo(source.pos, 1));
            }
        });

        var construction_sites = curRoom.find(FIND_CONSTRUCTION_SITES);
        var towers = curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
        var links = curRoom.find(FIND_STRUCTURES, { filter: (structure) => { return (structure.structureType == STRUCTURE_LINK); } });
        var factory = curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } })[0];
        var extractor = curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR } })[0];
        var nuker = curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0];

        const links_by_source = _.filter(links, link =>
            _.some(e_sources, source => link.pos.inRangeTo(source, 2))
        );

        var damaged_structures = _.filter(curRoom.find(FIND_STRUCTURES), (s) =>
            (s.hits < s.hitsMax) &&
            (s.structureType == STRUCTURE_WALL ? (s.hits <= wall_max_hp) : true) &&
            (s.structureType == STRUCTURE_RAMPART ? (s.hits <= rampart_max_hp) : true))
            .sort(function (a, b) { return +a.hits - +b.hits });

        const all_structures = {
            spawns: spawn_list,
            main_spawn: main_spawn,
            containers: containers,
            e_sources: e_sources,
            m_sources: m_sources,
            containers_by_source: containers_by_source,
            links_by_source: links_by_source,
            construction_sites: construction_sites,
            towers: towers,
            terminal: curRoom.terminal,
            storage: curRoom.storage,
            controller: curRoom.controller,
            links: links,
            extractor: extractor,
            factory: factory,
            nuker: nuker,
            damaged_structures: damaged_structures,
        };
        all_structures_in_room[curRoom.name] = all_structures;

        // -------------------------------------
        // tower logic
        // -------------------------------------
        for (var id in towers) {
            var tower = towers[id];
            if (tower) {
                // highest proirity -> fight hostiles
                if (curRoom.memory.attacked) {
                    var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                    if (closestHostile) {
                        tower.attack(closestHostile);
                    }
                }
                // then repair
                else {
                    var closestInjuredCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
                        filter: (creep) => creep.hits < creep.hitsMax
                    });
                    var closestDamagedStructure_nowall = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => structure.hits < structure.hitsMax && structure.structureType != STRUCTURE_WALL && (structure.structureType == STRUCTURE_RAMPART ? (structure.hits <= rampart_max_hp) : true)
                    });
                    if (closestInjuredCreep) {
                        tower.heal(closestInjuredCreep);
                    }
                    else {
                        if (closestDamagedStructure_nowall) {
                            tower.repair(closestDamagedStructure_nowall);
                        }
                        else { // no repairable non-wall structure -> repair walls too if allowed
                            if (curRoom.memory.tower_repair_walls) {

                                if (damaged_structures.length > 0) {
                                    tower.repair(damaged_structures[0]);
                                }
                            }
                        }
                    }
                }
            }
        }

        // -------------------------------------
        // market and terminal trades
        // -------------------------------------
        if (curRoom.terminal && (Game.time % 30 == 0)) {
            // sell mineralType
            if (curRoom.terminal.store[RESOURCE_ENERGY] >= 2000 && curRoom.terminal.store[curRoom.memory.mineralType] > 1000) {
                var available_mineral = Math.abs(curRoom.terminal.store[curRoom.memory.mineralType] - 1000);
                var available_energy = curRoom.terminal.store[RESOURCE_ENERGY];
                var orders = Game.market.getAllOrders(order => order.resourceType == curRoom.memory.mineralType &&
                    order.type == ORDER_BUY && order.amount >= 5 &&
                    // INFO this only consideres orders where max amount can be dealt
                    Game.market.calcTransactionCost(Math.min(available_mineral, order.remainingAmount), curRoom.name, order.roomName) <= available_energy);
                orders.sort(function (a, b) { return b.price - a.price; });
                log.market(`[MARKET] ${orders[0].resourceType} => orders found: ${orders.length}, best price: ${orders[0].price}, amount: ${orders[0].amount}`, curRoom.name);
                if (orders[0].price >= market_prices[orders[0].resourceType]) {
                    var result = Game.market.deal(orders[0].id, Math.min(available_mineral, orders[0].remainingAmount), curRoom.name);
                    if (result == 0) log.market(`[MARKET] ${orders[0].resourceType} => order completed successfully`, curRoom.name);
                }
            }
            // sell excess energy
            if (curRoom.terminal.store[RESOURCE_ENERGY] > 10000) {
                var available_energy = curRoom.terminal.store[RESOURCE_ENERGY];
                var sellable_energy = curRoom.terminal.store[RESOURCE_ENERGY] - 10000;
                var orders = Game.market.getAllOrders(order => order.resourceType == RESOURCE_ENERGY &&
                    order.type == ORDER_BUY && order.amount >= 20 &&
                    // INFO this only consideres orders where max amount can be dealt
                    Game.market.calcTransactionCost(Math.min(sellable_energy, order.remainingAmount), curRoom.name, order.roomName) <= available_energy);
                orders.sort(function (a, b) { return b.price - a.price; });
                log.market(`[MARKET] ${orders[0].resourceType} => orders found: ${orders.length}, best price: ${orders[0].price}, amount: ${orders[0].amount}`, curRoom.name);
                if (orders[0].price >= market_prices[orders[0].resourceType]) {
                    var result = Game.market.deal(orders[0].id, Math.min(sellable_energy, orders[0].remainingAmount), curRoom.name);
                    if (result == 0) log.market(`[MARKET] ${orders[0].resourceType} => order completed successfully`, curRoom.name);
                }
            }
        }

        manageStage(curRoom, all_structures);
        manageSpawns(curRoom, all_structures);
        visuals.run(curRoom, all_structures);
        linkManager.run(curRoom, all_structures);

        // -------------------------------------
        // claim flags: spawn claimer
        // -------------------------------------
        const claimFlags = Object.values(Game.flags).filter(f => f.name.toLowerCase().includes('claim'));

        // skip if no claim flags
        if (claimFlags.length > 0) {
            for (const flag of claimFlags) {
                const targetRoom = flag.pos.roomName;
                spawnClaimer(curRoom, targetRoom, flag);
            }
        }

        // -------------------------------------
        // new room claiming bootsrap
        // -------------------------------------
        // new room needs at least 1 harvester and 1 builder
        const newRooms = Object.values(Game.rooms).filter(r =>
            r.controller && r.controller.my && r.find(FIND_MY_SPAWNS).length === 0);

        for (const remoteRoom of newRooms) {
            spawnBootstrap(curRoom, remoteRoom);
        }

        // -------------------------------------
        // room support logic
        // -------------------------------------
        const supportFlags = Object.values(Game.flags).filter(f => f.name.toLowerCase().includes('support'));

        for (const flag of supportFlags) {
            const targetRoom = flag.room;

            // skip if the current loop room is the target
            if (curRoom.name === targetRoom.name) continue;

            // skip low-level rooms (we only want well-developed supporters)
            if (curRoom.controller.level < 7) continue;

            spawnSupporter(curRoom, targetRoom, flag);
        }

        // -------------------------------------
        // scout logic
        // only well-developed rooms should send scouts
        // -------------------------------------
        const scoutFlags = Object.values(Game.flags).filter(f => f.name.toLowerCase().includes('scout'));

        // spawn interval control
        if (!Memory.lastScoutSpawn) Memory.lastScoutSpawn = 0;

        if (curRoom.controller.level >= 7 && Game.time - Memory.lastScoutSpawn > 500 && scoutFlags.length > 0) {
            for (const flag of scoutFlags) {
                // skip if this room is the target
                if (curRoom.name === flag.pos.roomName) continue;

                spawnScout(curRoom, flag.pos.roomName, flag);
                Memory.lastScoutSpawn = Game.time;
                break;
            }
        }

        // invader failsave
        if (curRoom.memory.attacked) {
            console.log(`[WARN] ${curRoom.name} is being attacked by ${JSON.stringify(curRoom.find(FIND_HOSTILE_CREEPS).map(a => a.name))}`);
            //Game.notify(curRoom.name + " is being attacked by " + JSON.stringify(curRoom.find(FIND_HOSTILE_CREEPS).map(a => a.name)));
            if (false && !curRoom.controller.safeMode && curRoom.controller.safeModeAvailable) {
                console.log("[INFO] activating safeMode in room " + curRoom.name);
                Game.notify("[INFO] activating safeMode in room " + curRoom.name);
                //curRoom.controller.activateSafeMode();
            }
        }

        // controller decay failsave
        if (curRoom.controller.my && curRoom.controller.ticksToDowngrade <= 250) {
            console.log("[INFO] controller decaying in room " + curRoom.name);
            Game.notify("[INFO] controller decaying in room " + curRoom.name);
            // prio queue a creep to handle controller
        }
    }

    // safe mode is activated by curRoom.controller.activateSafeMode()
    // carrier should be run last so it will get priority on resources
    // creep run loop
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        const role = creep.memory.role;

        if (roles[role]) {
            roles[role].run(creep, all_structures_in_room[creep.room.name]);
        } else {
            console.log(`[ERROR] Unknown role: ${role} (${creep.name})`);
        }
    }


    if (Game.time % 100 === 0) {
        const memorySize = JSON.stringify(Memory).length;
        if (memorySize > 1000000) {
            console.log('[WARN] Memory approaching dangerous levels: ', memorySize);
            console.log(
                Object.keys(Memory)
                    .map(k => `Memory.${k}: ${JSON.stringify(Memory[k]).length}`)
                    .join('\n')
            );
        }
    }
}

global.reset_memory = function () {
    for (const key in Memory) {
        if (key !== 'creeps') delete Memory[key];
    }
    console.log("[INFO] Memory wiped.");
};
