// TODO gamestaging with screeb production control
// TODO invader failsave
// TODO room controller decay failsave

// role imports
const roles = require('roles');

// misc imports
var queue = require('utils.creep-queue');

var tower_repair_walls = true;
var wall_max_hp = 20000000;
var rampart_max_hp = 10000000;
// market situation for shard 3
var market_prices = { "U": 70, "L": 15.4, "Z": 20.0, "H": 200, "O": 5.5, "K": 2.0, "X": 3.9, "energy": 18 };


// MIT spec
function genUUID(roomName) {
    var d = new Date().getTime(); // Timestamp
    var d2 = 0;
    // replace 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' for RFC4122 v4 UUID
    return roomName + '-xxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16; // random number between 0 and 16
        if (d > 0) { // Use timestamp until depleted
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else { // Use microseconds since page-load if supported
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

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

        // skip rooms you don't own (e.g., observer or neutral rooms)
        if (!curRoom.controller || !curRoom.controller.my) continue;

        const spawn_list = curRoom.find(FIND_MY_SPAWNS);
        if (spawn_list.length < 1) continue;
        const main_spawn = spawn_list[0];
        // store main spawn id in memory for creeps to reference later
        Memory.rooms[curRoom.name].mainSpawnId = main_spawn.id;

        var containers = curRoom.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_CONTAINER);
            }
        });
        var e_sources = curRoom.find(FIND_SOURCES); // energy sources
        var m_sources = curRoom.find(FIND_MINERALS, { filter: (m) => { return (m.mineralAmount > 0); } }); // active mineral sources
        if (!curRoom.memory.mineralType) {
            if (curRoom.find(FIND_MINERALS).length >= 1) {
                curRoom.memory.mineralType = curRoom.find(FIND_MINERALS)[0].mineralType;
            } else { curRoom.memory.mineralType = "none"; }
        }

        // if a link system is available for upgraders to use (contr lvl 5+ only)
        var links = curRoom.find(FIND_STRUCTURES, { filter: (structure) => { return (structure.structureType == STRUCTURE_LINK); } });
        curRoom.memory.link_avail_ug = (links.length >= 2) ? true : false;

        var constructionSites = curRoom.find(FIND_CONSTRUCTION_SITES);
        if (curRoom.find(FIND_HOSTILE_CREEPS).length > 0) {
            curRoom.memory.attacked = true;
        }
        else { curRoom.memory.attacked = false; }
        if (curRoom.energyAvailable < (curRoom.energyCapacityAvailable - ((spawn_list.length - 1) * 300))) {
            curRoom.memory.energyfull = false;
        } else { curRoom.memory.energyfull = true; }
        if (curRoom.storage && curRoom.storage.store[RESOURCE_ENERGY] >= curRoom.storage.store.getCapacity() * 0.75) { tower_repair_walls = false; } else { tower_repair_walls = false; }
        // -------------------------------------

        // -------------------------------------
        // Assign stage based on controllerLevel
        // -------------------------------------
        let controllerLevel = curRoom.controller.level;
        // level 0-2
        if (controllerLevel < 3) {
            curRoom.memory.stage = 1;
        }
        // level 3
        if (controllerLevel == 3) {
            curRoom.memory.stage = 2;
        }
        // level 4-5
        if (controllerLevel > 3 && controllerLevel < 6) {
            curRoom.memory.stage = 3;
        }
        // level 6-7
        if (controllerLevel > 5 && controllerLevel < 8) {
            curRoom.memory.stage = 4;
        }
        // level 7+
        if (controllerLevel > 7) {
            curRoom.memory.stage = 4; // stage 5 is currently unused
        }
        // -------------------------------------

        //tower logic
        var rhash = curRoom.toString().substring(5).slice(0, -1);
        var towers = curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });

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
                            if (tower_repair_walls) {
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
        // -------------------------------------

        const roomCreeps = _.filter(Game.creeps, c => c.room.name == curRoom.name);

        //array of harvesters
        var harvesters = _.filter(roomCreeps, (creep) => creep.memory.role == 'harvester');
        var builders = _.filter(roomCreeps, (creep) => creep.memory.role == 'builder');
        var upgraders = _.filter(roomCreeps, (creep) => creep.memory.role == 'upgrader');
        var defenders = _.filter(roomCreeps, (creep) => creep.memory.role == 'defender');
        var carriers = _.filter(roomCreeps, (creep) => creep.memory.role == 'carrier');
        var attackers = _.filter(roomCreeps, (creep) => creep.memory.role == 'attacker');
        var labtechs = _.filter(roomCreeps, (creep) => creep.memory.role == 'labtech');
        var splitters = _.filter(roomCreeps, (creep) => creep.memory.role == 'splitter');
        var extractors = _.filter(roomCreeps, (creep) => creep.memory.role == 'extractor');
        var claimers = _.filter(roomCreeps, (creep) => creep.memory.role == 'claimer');

        // -------------------------------------
        // implemented a little safeguard here, if room has less than 2 creeps it is considered to be in danger
        // therefore we need to bootstrap it with stage 1
        // -------------------------------------
        if (roomCreeps.length < 2) {
            curRoom.memory.stage = 1;
        }

        // -------------------------------------
        // creep manager
        // auto spawn logic
        // -------------------------------------
        switch (curRoom.memory.stage) {
            // level 0-2
            // spawn order at beginning: harvester, carrier, harvester, carrier, ..., upgrader, builder
            case 1:
                if (curRoom.find(FIND_MY_CREEPS).length < 1) {
                    curRoom.memory.init = true;
                } else {
                    curRoom.memory.init = undefined;
                }
                if (curRoom.memory.init) {
                    var newName = 'H-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, MOVE], newName,
                        { memory: { role: 'harvester' } }))) {
                        console.log('Spawning new harvester: ' + newName);
                    }
                }
                else {
                    if (harvesters.length < e_sources.length) {
                        var newName = 'H-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, MOVE], newName,
                            { memory: { role: 'harvester' } }))) {
                            console.log('Spawning new harvester: ' + newName);
                        }
                    }
                    if (builders.length < 2) { //4
                        var newName = 'B-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, CARRY, CARRY, MOVE, MOVE], newName,
                            { memory: { role: 'builder' } }))) {
                            console.log('Spawning new builder: ' + newName);
                        }
                    }
                    if (upgraders.length < 1) { //3
                        var newName = 'U-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, CARRY, MOVE, MOVE, CARRY], newName,
                            { memory: { role: 'upgrader' } }))) {
                            console.log('Spawning new upgrader: ' + newName);
                        }
                    }
                    if (carriers.length < 2) {//containers.length
                        var newName = 'C-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([MOVE, MOVE, CARRY, CARRY], newName,
                            { memory: { role: 'carrier' } }))) {
                            console.log('Spawning new carrier: ' + newName);
                        }
                    }
                    if (defenders.length < 0) { //1
                        var newName = 'D-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([TOUGH, ATTACK, ATTACK, ATTACK, MOVE], newName,
                            { memory: { role: 'defender' } }))) {
                            console.log('Spawning new defender: ' + newName);
                        }
                    }
                }
                break;
            // level 3
            case 2:
                if (curRoom.memory.energyfull) {
                    var nb = 1;
                    var nu = 2;
                    var nd = 0;
                } else {// energy save mode -> prioritise harvesters and carriers
                    var nb = 1;
                    var nu = 1;
                    var nd = 0;
                }
                if (curRoom.memory.attacked) { nd = 0; nu = 1; nb = 0; }
                if (harvesters.length < e_sources.length) { //e_sources.length
                    var newName = 'H-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE], newName,
                        { memory: { role: 'harvester' } }))) {
                        console.log('Spawning new harvester: ' + newName);
                    }
                }
                if (constructionSites.length <= 0) {
                    // we dont need builders
                } else {
                    if (builders.length < nb) { //3
                        var newName = 'B-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE], newName,
                            { memory: { role: 'builder' } }))) {
                            console.log('Spawning new builder: ' + newName);
                        }
                    }
                }
                if (upgraders.length < nu) { //7
                    var newName = 'U-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], newName,
                        { memory: { role: 'upgrader' } }))) {
                        console.log('Spawning new upgrader: ' + newName);
                    }
                }
                if (defenders.length < nd) { //1
                    var newName = 'D-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE], newName,
                        { memory: { role: 'defender' } }))) {
                        console.log('Spawning new defender: ' + newName);
                    }
                }
                if (carriers.length < containers.length) {//containers.length
                    var newName = 'C-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([MOVE, MOVE, MOVE, CARRY, CARRY, CARRY], newName,
                        { memory: { role: 'carrier' } }))) {
                        console.log('Spawning new carrier: ' + newName);
                    }
                }
                break;
            // level 4-5
            case 3:
                if (curRoom.memory.energyfull) {
                    var nb = 1; // 2-3
                    var nu = 3; // 4-5 are normal
                    var nd = 0;
                    var ns = 1;
                } else {// energy save mode -> prioritise harvesters and carriers
                    var nb = 0;
                    var nu = 1;
                    var nd = 0;
                    var ns = 1;
                }
                if (curRoom.memory.link_avail_ug) { nu = 1; }
                if (curRoom.memory.attacked) { nd = 1; nu = 1; nb = 0; }
                if (harvesters.length < e_sources.length) { //e_sources.length
                    var newName = 'H-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE, MOVE], newName,
                        { memory: { role: 'harvester' } }))) {
                        console.log('Spawning new harvester: ' + newName);
                    }
                }
                if (constructionSites.length <= 0) {
                    // we dont need builders
                } else {
                    if (builders.length < nb) {
                        var newName = 'B-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], newName,
                            { memory: { role: 'builder' } }))) {
                            console.log('Spawning new builder: ' + newName);
                        }
                    }
                }
                if (upgraders.length < nu) { //
                    var newName = 'U-' + genUUID(curRoom.name);
                    if (curRoom.memory.link_avail_ug) {
                        var u_body = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
                    }
                    else {
                        var u_body = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    }
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep(u_body, newName,
                        { memory: { role: 'upgrader' } }))) {
                        console.log('Spawning new upgrader: ' + newName);
                    }
                }
                if (defenders.length < nd) { //1
                    var newName = 'D-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE], newName,
                        { memory: { role: 'defender' } }))) {
                        console.log('Spawning new defender: ' + newName);
                    }
                }
                if (carriers.length < containers.length) {//containers.length
                    var newName = 'C-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], newName,
                        { memory: { role: 'carrier' } }))) {
                        console.log('Spawning new carrier: ' + newName);
                    }
                }
                if (splitters.length < ns) { //1
                    var newName = 'S-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY], newName,
                        { memory: { role: 'splitter' } }))) {
                        console.log('Spawning new splitter: ' + newName);
                    }
                }
                break;
            // level 6-7
            case 4:
                if (curRoom.memory.energyfull) {
                    var nb = 1; // 2-3
                    var nu = 3; // 
                    var nd = 0;
                    var ns = 1;
                } else {// energy save mode -> prioritise harvesters and carriers
                    var nb = 0;
                    var nu = 1;
                    var nd = 0;
                    var ns = 1;
                }
                if (curRoom.memory.link_avail_ug) { nu = 1; }
                if (curRoom.memory.attacked) { nd = 1; nu = 1; nb = 0; }
                if (harvesters.length < e_sources.length) { //e_sources.length
                    var newName = 'H-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE, MOVE], newName,
                        { memory: { role: 'harvester' } }))) {
                        console.log('Spawning new harvester: ' + newName);
                    }
                }
                if (constructionSites.length <= 0) {
                    // we dont need builders
                } else {
                    if (builders.length < nb) {
                        var newName = 'B-' + genUUID(curRoom.name);
                        if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], newName,
                            { memory: { role: 'builder' } }))) {
                            console.log('Spawning new builder: ' + newName);
                        }
                    }
                }
                if (upgraders.length < nu) { //
                    var newName = 'U-' + genUUID(curRoom.name);
                    if (curRoom.memory.link_avail_ug) {
                        var u_body = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
                    }
                    else {
                        var u_body = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    }
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep(u_body, newName,
                        { memory: { role: 'upgrader' } }))) {
                        console.log('Spawning new upgrader: ' + newName);
                    }
                }
                if (defenders.length < nd) { //1
                    var newName = 'D-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE], newName,
                        { memory: { role: 'defender' } }))) {
                        console.log('Spawning new defender: ' + newName);
                    }
                }
                if (carriers.length < e_sources.length + m_sources.length) { // every e_source + dedicated mineral carrier
                    var newName = 'C-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], newName,
                        { memory: { role: 'carrier' } }))) {
                        console.log('Spawning new carrier: ' + newName);
                    }
                }
                if (splitters.length < ns) { //1
                    var newName = 'S-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY], newName,
                        { memory: { role: 'splitter' } }))) {
                        console.log('Spawning new splitter: ' + newName);
                    }
                }
                if (extractors.length < m_sources.length) {
                    var newName = 'E-' + genUUID(curRoom.name);
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(main_spawn.spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE, MOVE], newName,
                        { memory: { role: 'extractor' } }))) {
                        console.log('Spawning new extractor: ' + newName);
                    }
                }
                break;
            // level 7+
            case 5:
                break;
            default:
                console.log("[ERROR] could not detect game's stage");
                break;
        }

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

        if (main_spawn.spawning) {
            var spawningCreep = Game.creeps[main_spawn.spawning.name];
            main_spawn.room.visual.text(
                '♻️️️' + spawningCreep.memory.role,
                main_spawn.pos.x + 1,
                main_spawn.pos.y,
                { align: 'left', opacity: 0.8 });
        }

        // assign 1 harvestes to every source
        for (var s = 0; s < e_sources.length; s++) {
            var assigned = false;
            for (var h = 0; h < harvesters.length; h++) { if (harvesters[h].memory.sourceID == e_sources[s].id) { assigned = true; } }
            //console.log('source ' + e_sources[s].id + ' ' + assigned)
            if (!assigned) {
                for (var a = 0; a < harvesters.length; a++) {
                    if (harvesters[a].memory.sourceID == undefined) {
                        var harv = harvesters[a];
                        harv.memory.sourceID = e_sources[s].id;
                        break;
                    }
                }
            }
        }

        // assign carriers accordingly to containers (above stage 2)
        if (curRoom.memory.stage < 2) {
            for (var s = 0; s < e_sources.length; s++) {
                var assigned = false;
                for (var h = 0; h < carriers.length; h++) { if (carriers[h].memory.sourceID == e_sources[s].id) { assigned = true; } }
                //console.log('source ' + e_sources[s].id + ' ' + assigned)
                if (!assigned) {
                    for (var a = 0; a < carriers.length; a++) { if (carriers[a].memory.sourceID == undefined) { var carr = carriers[a]; carr.memory.sourceID = e_sources[s].id; break; } }
                }
            }
        } else {
            for (var c = 0; c < containers.length; c++) {
                if (containers.length < carriers.length) {
                    // now theres more carriers than containers so we need to assign multiple
                    var assigned_n = 0;
                    for (var a = 0; a < carriers.length; a++) { if (carriers[a].memory.containerID == containers[c].id) { assigned_n++; } }
                    //console.log('container ' + containers[c].id + ' has ' + assigned_n+ ' carriers')
                    if (assigned_n == 0) { //if container is not assigned -> give is first carrier without a job
                        for (var a = 0; a < carriers.length; a++) {
                            if (carriers[a].memory.containerID == undefined) {
                                var carr = carriers[a];
                                carr.memory.containerID = containers[c].id;
                                break;
                            }
                        }
                    }
                    if (assigned_n == 1) { //if container has 1 carr assigned -> give another carrier without a job
                        for (var a = 0; a < carriers.length; a++) {
                            if (carriers[a].memory.containerID == undefined) {
                                var carr = carriers[a];
                                carr.memory.containerID = containers[c].id;
                                break;
                            }
                        }
                    }
                    // NOTE 2 carrs per container is the max rn, because it wouldnt be efficient
                    if (assigned_n > 2) { //if container has 2 carr assigned -> give no carriers
                        console.log('[ERROR] unassigned carrier ' + curRoom.name)
                    }
                }
                else {
                    var assigned = false;
                    for (var a = 0; a < carriers.length; a++) { if (carriers[a].memory.containerID == containers[c].id) { assigned = true; } }
                    //console.log('container ' + containers[c].id + ' ' + assigned)
                    if (!assigned) {
                        for (var b = 0; b < carriers.length; b++) {
                            if (carriers[b].memory.containerID == undefined) {
                                var carr = carriers[b];
                                carr.memory.containerID = containers[c].id;
                                break;
                            }
                        }
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
