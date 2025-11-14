// WIP gamestaging with screep production control
// TODO invader failsave
// TODO room controller decay failsave

const roles = require('roles');
const visuals = require('manager.visuals');
const { manageStage } = require('manager.stage');
const { genUUID, manageSpawns } = require('manager.spawn');

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
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    // -------------------------------------
    // generate pixel when bucket is full
    // -------------------------------------
    if (Game.cpu.bucket >= 10000) { Game.cpu.generatePixel() }

    // -------------------------------------
    // Handle all owned rooms dynamically
    // -------------------------------------
    for (let roomName in Game.rooms) {
        const curRoom = Game.rooms[roomName];

        // skip rooms i don't own (e.g. observer or neutral rooms)
        if (!curRoom.controller || !curRoom.controller.my) continue;

        const spawn_list = curRoom.find(FIND_MY_SPAWNS);
        if (spawn_list.length < 1) continue;
        const main_spawn = spawn_list[0];
        curRoom.memory.mainSpawnId = main_spawn.id;

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

        const all_structures = {
            spawns: spawn_list,
            main_spawn: main_spawn,
            containers: containers,
            e_sources: e_sources,
            m_sources: m_sources,
            containers_by_source: containers_by_source,
            construction_sites: construction_sites,
            towers: towers,
            terminal: curRoom.terminal,
            storage: curRoom.storage,
            controller: curRoom.controller,
            links: links,
            extractor: extractor,
            factory: factory,
            nuker: nuker

        };


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
                                var damagedStructure = _.filter(tower.room.find(FIND_STRUCTURES), (s) => (s.hits < s.hitsMax) && (s.structureType == STRUCTURE_WALL ? (s.hits <= wall_max_hp) : true) && (s.structureType == STRUCTURE_RAMPART ? (s.hits <= rampart_max_hp) : true)).sort(function (a, b) { return +a.hits - +b.hits });
                                if (damagedStructure) {
                                    tower.repair(damagedStructure[0]);
                                }
                            }
                        }
                    }
                }
            }
        }

        // -------------------------------------
        // link logic
        // -------------------------------------
        if (curRoom.memory.link_avail_ug) {
            var link_base = main_spawn.pos.findClosestByRange(curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } }));
            var link_controller = curRoom.controller.pos.findClosestByRange(curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } }));
            if (link_controller.store.getFreeCapacity(RESOURCE_ENERGY) > link_controller.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                link_base.transferEnergy(link_controller);
            }
        }
        // -------------------------------------

        // -------------------------------------
        // market and terminal trades
        // -------------------------------------
        if (curRoom.terminal && (Game.time % 20 == 0)) {
            // sell mineralType
            if (curRoom.terminal.store[RESOURCE_ENERGY] >= 2000 && curRoom.terminal.store[curRoom.memory.mineralType] > 1000) {
                var available_mineral = Math.abs(curRoom.terminal.store[curRoom.memory.mineralType] - 1000);
                var available_energy = curRoom.terminal.store[RESOURCE_ENERGY];
                var orders = Game.market.getAllOrders(order => order.resourceType == curRoom.memory.mineralType &&
                    order.type == ORDER_BUY &&
                    // INFO this only consideres orders where max amount can be dealt
                    Game.market.calcTransactionCost(Math.min(available_mineral, order.remainingAmount), curRoom.name, order.roomName) <= available_energy);
                console.log("'" + curRoom.memory.mineralType + "'" + ' buy orders found: ' + orders.length);
                orders.sort(function (a, b) { return b.price - a.price; });
                console.log('Best price: ' + orders[0].price);
                if (orders[0].price >= market_prices[orders[0].resourceType]) {
                    var result = Game.market.deal(orders[0].id, Math.min(available_mineral, orders[0].remainingAmount), curRoom.name);
                    if (result == 0) {
                        console.log(`${orders[0].resourceType}: Order completed successfully`);
                    }
                }
            }
            // sell excess energy
            if (curRoom.terminal.store[RESOURCE_ENERGY] > 10000) {
                var available_energy = curRoom.terminal.store[RESOURCE_ENERGY];
                var sellable_energy = curRoom.terminal.store[RESOURCE_ENERGY] - 10000;
                var orders = Game.market.getAllOrders(order => order.resourceType == RESOURCE_ENERGY &&
                    order.type == ORDER_BUY &&
                    // INFO this only consideres orders where max amount can be dealt
                    Game.market.calcTransactionCost(Math.min(sellable_energy, order.remainingAmount), curRoom.name, order.roomName) <= available_energy);
                console.log("'" + RESOURCE_ENERGY + "'" + ' buy orders found: ' + orders.length);
                orders.sort(function (a, b) { return b.price - a.price; });
                console.log('Best price: ' + orders[0].price);
                if (orders[0].price >= market_prices[orders[0].resourceType]) {
                    var result = Game.market.deal(orders[0].id, Math.min(sellable_energy, orders[0].remainingAmount), curRoom.name);
                    if (result == 0) {
                        console.log(`${orders[0].resourceType}: Order completed successfully`);
                    }
                }
            }
        }

        manageStage(curRoom, all_structures);
        manageSpawns(curRoom, all_structures);
        visuals.run(curRoom, all_structures);

        // -------------------------------------
        // claim flags: spawn claimer
        // -------------------------------------
        const claimFlags = Object.values(Game.flags).filter(f => f.name.toLowerCase().includes('claim'));

        // skip if no claim flags
        if (claimFlags.length > 0) {

            // check all claim flags to see if any still need claimer
            for (const flag of claimFlags) {
                const targetRoom = flag.pos.roomName;

                // if we already have a claimer assigned to this target
                const existingClaimers = _.filter(Game.creeps, c =>
                    c.memory.role === 'claimer' &&
                    c.memory.targetRoom === targetRoom
                );

                // spawn new claimer only if none exist for this flag
                if (existingClaimers.length === 0) {
                    var newName = 'L-' + genUUID(curRoom.name);
                    const body = [MOVE, CLAIM, MOVE, MOVE, MOVE, MOVE, CARRY, WORK];

                    const result = main_spawn.spawnCreep(body, newName, {
                        memory: {
                            role: 'claimer',
                            homeRoom: main_spawn.room.name,
                            targetFlag: flag.name,
                            targetRoom: targetRoom
                        }
                    });

                    if (result === OK) {
                        console.log(`Spawning new claimer for ${targetRoom} via flag ${flag.name}`);
                    }
                }
            }
        }

        // -------------------------------------
        // new room claiming bootsrap
        // -------------------------------------
        // new room needs at least 1 harvester and 1 builder
        const newRooms = Object.values(Game.rooms).filter(r =>
            r.controller && r.controller.my && r.find(FIND_MY_SPAWNS).length === 0);

        for (const remoteRoom of newRooms) {
            const remoteName = remoteRoom.name;
            const remoteCreeps = _.filter(Game.creeps, c => c.memory.targetRoom === remoteName);

            const numHarvesters = _.filter(remoteCreeps, c => c.memory.role === 'harvester').length;
            const numBuilders = _.filter(remoteCreeps, c => c.memory.role === 'builder').length;
            const numUpgraders = _.filter(remoteCreeps, c => c.memory.role === 'upgrader').length;

            // get the sources in the remote room (may be undefined if not visible)
            const sources = remoteRoom.find(FIND_SOURCES);

            // spawn bootstrap creeps
            if (numHarvesters < sources.length) {
                const unassignedSources = sources.filter(src =>
                    !_.some(remoteCreeps, c => c.memory.sourceID === src.id && c.memory.role === 'harvester')
                );

                if (unassignedSources.length > 0) {
                    const src = unassignedSources[0];
                    const name = 'INIT-H-' + genUUID(remoteName);
                    const res = main_spawn.spawnCreep(
                        [WORK, WORK, WORK, MOVE, MOVE],
                        name,
                        {
                            memory: {
                                role: 'harvester',
                                targetRoom: remoteName,
                                homeRoom: main_spawn.room.name,
                                sourceID: src.id
                            }
                        }
                    );
                    if (res === OK) console.log(`Spawning remote harvester for ${remoteName}, source ${src.id}`);
                }
            } else if (numBuilders < 2) {
                const name = 'INIT-B-' + genUUID(remoteName);
                const res = main_spawn.spawnCreep(
                    [WORK, CARRY, CARRY, MOVE, MOVE],
                    name,
                    {
                        memory: {
                            role: 'builder',
                            targetRoom: remoteName,
                            homeRoom: main_spawn.room.name
                        }
                    }
                );
                if (res === OK) console.log(`Spawning remote builder for ${remoteName}`);
            } else if (numUpgraders < 1) {
                const name = 'INIT-U-' + genUUID(remoteName);
                const res = main_spawn.spawnCreep(
                    [WORK, WORK, CARRY, MOVE, MOVE],
                    name,
                    {
                        memory: {
                            role: 'upgrader',
                            targetRoom: remoteName,
                            homeRoom: main_spawn.room.name
                        }
                    }
                );
                if (res === OK) console.log(`Spawning remote upgrader for ${remoteName}`);
            }
        }

        // -------------------------------------
        // room support logic
        // -------------------------------------
        const supportFlags = Object.values(Game.flags).filter(f => f.name.toLowerCase().includes('support'));

        for (const flag of supportFlags) {
            const targetRoom = flag.pos.roomName;

            // skip if the current loop room is the target
            if (curRoom.name === targetRoom) continue;

            // skip low-level rooms (we only want well-developed supporters)
            if (curRoom.controller.level < 7) continue;

            const targetCreeps = _.filter(Game.creeps, c => c.memory.targetRoom === targetRoom);
            const numHarvesters = _.filter(targetCreeps, c => c.memory.role === 'harvester' && c.memory.support).length;
            const numBuilders = _.filter(targetCreeps, c => c.memory.role === 'builder' && c.memory.support).length;
            const numUpgraders = _.filter(targetCreeps, c => c.memory.role === 'upgrader' && c.memory.support).length;

            const sources = Game.rooms[targetRoom].find(FIND_SOURCES);

            if (numHarvesters < sources.length && !main_spawn.spawning) {
                const unassignedSources = sources.filter(src =>
                    !_.some(targetCreeps, c => c.memory.sourceID === src.id && c.memory.role === 'harvester' && c.memory.support)
                );
                if (unassignedSources.length > 0) {
                    const src = unassignedSources[0];
                    const name = 'SUP-H-' + genUUID(targetRoom);
                    const res = main_spawn.spawnCreep(
                        [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE],
                        name,
                        {
                            memory: {
                                role: 'harvester',
                                targetRoom,
                                homeRoom: curRoom.name,
                                sourceID: src.id,
                                support: true
                            }
                        }
                    );
                    if (res === OK) console.log(`Spawning remote harvester for ${targetRoom}, source ${src.id}`);
                }

            }

            // spawn up to 2 builders for target room
            else if (numBuilders < 2 && !main_spawn.spawning) {
                const name = 'SUP-B-' + genUUID(targetRoom);
                const res = main_spawn.spawnCreep(
                    [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
                    name,
                    {
                        memory: {
                            role: 'builder',
                            targetRoom,
                            homeRoom: curRoom.name,
                            support: true
                        }
                    }
                );
                if (res === OK) console.log(`${curRoom.name}: Supporting ${targetRoom} with Builder`);
            }
            else if (numUpgraders < 1) {
                const name = 'SUP-U-' + genUUID(targetRoom);
                const res = main_spawn.spawnCreep(
                    [WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE],
                    name,
                    {
                        memory: {
                            role: 'upgrader',
                            targetRoom,
                            homeRoom: curRoom.name,
                            support: true
                        }
                    }
                );
                if (res === OK) console.log(`${curRoom.name}: Supporting ${targetRoom} with Upgrader`);
            }
        }

        // -------------------------------------
        // scout logic
        // -------------------------------------
        // only well-developed rooms should send scouts
        if (curRoom.controller && curRoom.controller.level >= 7) {
            const scoutFlags = Object.values(Game.flags).filter(f => f.name.toLowerCase().includes('scout'));

            // spawn interval control
            if (!Memory.lastScoutSpawn) Memory.lastScoutSpawn = 0;

            if (Game.time - Memory.lastScoutSpawn > 500 && scoutFlags.length > 0) {
                for (const flag of scoutFlags) {
                    // skip if this room is the target
                    if (curRoom.name === flag.pos.roomName) continue;

                    // skip if already has a scout assigned
                    const existing = _.some(Game.creeps, c =>
                        c.memory.role === 'scout' &&
                        c.memory.targetFlag === flag.name
                    );
                    if (existing) continue;

                    var newName = 'SCOUT-' + genUUID(curRoom.name);
                    const res = main_spawn.spawnCreep(
                        [MOVE],
                        newName,
                        {
                            memory: {
                                role: 'scout',
                                homeRoom: curRoom.name,
                                targetFlag: flag.name,
                                targetRoom: flag.pos.roomName
                            }
                        }
                    );

                    if (res === OK) {
                        Memory.lastScoutSpawn = Game.time;
                        console.log(`Dispatching scout ${newName} from ${curRoom.name} to ${flag.pos.roomName}`);
                        break; // only send one per interval
                    }
                }
            }
        }

        // invader failsave
        if (curRoom.memory.attacked) {
            console.log(curRoom.name + " is being attacked by " + JSON.stringify(curRoom.find(FIND_HOSTILE_CREEPS).map(a => a.name)));
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
            roles[role].run(creep);
        } else {
            console.log(`[Error] Unknown role: ${role} (${creep.name})`);
        }
    }


    if (Game.time % 100 === 0) {
        const memorySize = JSON.stringify(Memory).length;
        if (memorySize > 1000000) {
            console.log('Memory approaching dangerous levels: ', memorySize);
            console.log(
                Object.keys(Memory)
                    .map(k => `Memory.${k}: ${JSON.stringify(Memory[k]).length}`)
                    .join('\n')
            );
        }
    }
}
