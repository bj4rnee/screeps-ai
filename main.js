// DONE builder repair nearest target (not wall, if nothing left -> taget wall)
// TODO gamestaging with screeb production control
// TODO invader failsave
// TODO room controller decay failsave
// DONE harvester not swap when dead
// DONE carriers arent split evenly

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleDefender = require('role.defender');
var roleCarrier = require('role.carrier');
var roleAttacker = require('role.attacker');
var roleSplitter = require('role.splitter');

var tower_repair_walls = true;
var wall_max_hp = 2000000;
var rampart_max_hp = 10000000;

function queueCreep(room, attributes, name, role) {
    Memory.spawn_queue = 0;
    return true;
}

// MIT spec
function genUUID() {
    var d = new Date().getTime(); // Timestamp
    var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0; // Time in microseconds since page-load or 0 if unsupported
    // replace 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' for RFC4122 v4 UUID
    return 'xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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

module.exports.loop = function () {

    // garbage collector
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

    // -------------------------------------
    // current room ('W2S43') and evironment
    // -------------------------------------
    var rooml = [];
    for (let room_ in Game.rooms) { rooml.push(room_); }
    //var spawns_ = rooml[0].find(FIND_MY_SPAWNS);
    //console.log(spawns_);
    var curRoom = Game.spawns['spawn0'].room;
    var containers = curRoom.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType == STRUCTURE_CONTAINER);
        }
    });
    var e_sources = curRoom.find(FIND_SOURCES);

    // if a link system is available for upgraders to use (contr lvl 5+ only)
    var links = curRoom.find(FIND_STRUCTURES, { filter: (structure) => { return (structure.structureType == STRUCTURE_LINK); } });
    curRoom.memory.link_avail_ug = (links.length >= 2) ? true : false;

    var constructionSites = curRoom.find(FIND_CONSTRUCTION_SITES);
    if (curRoom.find(FIND_HOSTILE_CREEPS).length > 0) {
        curRoom.memory.attacked = true;
    }
    else { curRoom.memory.attacked = false; }
    if (curRoom.energyAvailable < curRoom.energyCapacityAvailable) {
        curRoom.memory.energyfull = false;
    } else { curRoom.memory.energyfull = true; }
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
        curRoom.memory.stage = 5;
    }
    // -------------------------------------

    //tower logic
    var rhash = curRoom.toString().substring(5).slice(0, -1);
    var towers = curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });

    for (var id in towers) {
        var tower = towers[id];
        //var tower = Game.getObjectById('TOWER_ID');
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
                //var closestInjuredCreep = tower.pos.findClosestByRange(_.filter(tower.room.find(FIND_MY_CREEPS), (creep) => creep.hits < creep.hitsMax));
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
                            var damagedStructure = _.filter(tower.room.find(FIND_STRUCTURES), (s) => (s.hits < s.hitsMax) && (s.structureType == STRUCTURE_TOWER ? (s.hits <= wall_max_hp) : true) && (s.structureType == STRUCTURE_RAMPART ? (s.hits <= rampart_max_hp) : true)).sort(function (a, b) { return +a.hits - +b.hits });
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
        var link_base = curRoom.find(FIND_MY_SPAWNS)[0].pos.findClosestByRange(curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } }));
        var link_controller = curRoom.controller.pos.findClosestByRange(curRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } }));
        if (link_controller.store.getFreeCapacity(RESOURCE_ENERGY) > link_controller.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
            link_base.transferEnergy(link_controller);
        }
    }
    // -------------------------------------


    //array of harvesters
    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    var defenders = _.filter(Game.creeps, (creep) => creep.memory.role == 'defender');
    var carriers = _.filter(Game.creeps, (creep) => creep.memory.role == 'carrier');
    var attackers = _.filter(Game.creeps, (creep) => creep.memory.role == 'attacker');
    var splitters = _.filter(Game.creeps, (creep) => creep.memory.role == 'splitter');
    //console.log('Harvesters: ' + harvesters.length);

    // creep manager
    //auto spawn logic
    switch (curRoom.memory.stage) {
        // level 0-2
        // spawn order at beginning: harvester, carrier, harvester, carrier, ..., upgrader, builder
        case 1:
            if (curRoom.find(FIND_MY_CREEPS).length < e_sources.length * 2) {
                var newName = 'C-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([MOVE, MOVE, CARRY, CARRY], newName,
                    { memory: { role: 'carrier' } }))) {
                    console.log('Spawning new carrier: ' + newName);
                }
                var newName = 'H-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, MOVE], newName,
                        { memory: { role: 'harvester' } }))) {
                        console.log('Spawning new harvester: ' + newName);
                    }
            }
            else {
                if (harvesters.length < e_sources.length) {
                    var newName = 'H-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, MOVE], newName,
                        { memory: { role: 'harvester' } }))) {
                        console.log('Spawning new harvester: ' + newName);
                    }
                }
                if (builders.length < 0) { //4
                    var newName = 'B-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, CARRY, CARRY, MOVE], newName,
                        { memory: { role: 'builder' } }))) {
                        console.log('Spawning new builder: ' + newName);
                    }
                }
                if (upgraders.length < 1) { //3
                    var newName = 'U-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, CARRY, MOVE, MOVE, CARRY], newName,
                        { memory: { role: 'upgrader' } }))) {
                        console.log('Spawning new upgrader: ' + newName);
                    }
                }
                if (carriers.length < harvesters.length) {//containers.length
                    var newName = 'C-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([MOVE, MOVE, CARRY, CARRY], newName,
                        { memory: { role: 'carrier' } }))) {
                        console.log('Spawning new carrier: ' + newName);
                    }
                }
                if (defenders.length < 0) { //1
                    var newName = 'D-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([TOUGH, ATTACK, ATTACK, ATTACK, MOVE], newName,
                        { memory: { role: 'defender' } }))) {
                        console.log('Spawning new defender: ' + newName);
                    }
                }
            }
            break;
        // level 3
        case 2:
            if (curRoom.memory.energyfull) {
                var nb = 2;
                var nu = 7;
                var nd = 0;
            } else {// energy save mode -> prioritise harvesters and carriers
                var nb = 1;
                var nu = 1;
                var nd = 0;
            }
            if (curRoom.memory.attacked) { nd = 1; nu = 1; nb = 0; }
            if (harvesters.length < e_sources.length) { //e_sources.length
                var newName = 'H-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE], newName,
                    { memory: { role: 'harvester' } }))) {
                    console.log('Spawning new harvester: ' + newName);
                }
            }
            if (constructionSites.length <= 0) {
                // we dont need builders
            } else {
                if (builders.length < nb) { //3
                    var newName = 'B-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE], newName,
                        { memory: { role: 'builder' } }))) {
                        console.log('Spawning new builder: ' + newName);
                    }
                }
            }
            if (upgraders.length < nu) { //7
                var newName = 'U-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], newName,
                    { memory: { role: 'upgrader' } }))) {
                    console.log('Spawning new upgrader: ' + newName);
                }
            }
            if (defenders.length < nd) { //1
                var newName = 'D-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE], newName,
                    { memory: { role: 'defender' } }))) {
                    console.log('Spawning new defender: ' + newName);
                }
            }
            if (carriers.length < containers.length) {//containers.length
                var newName = 'C-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([MOVE, MOVE, MOVE, CARRY, CARRY, CARRY], newName,
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
                var newName = 'H-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE, MOVE], newName,
                    { memory: { role: 'harvester' } }))) {
                    console.log('Spawning new harvester: ' + newName);
                }
            }
            if (constructionSites.length <= 0) {
                // we dont need builders
            } else {
                if (builders.length < nb) {
                    var newName = 'B-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], newName,
                        { memory: { role: 'builder' } }))) {
                        console.log('Spawning new builder: ' + newName);
                    }
                }
            }
            if (upgraders.length < nu) { //
                var newName = 'U-' + genUUID();
                if (curRoom.memory.link_avail_ug) {
                    var u_body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
                }
                else {
                    var u_body = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                }
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep(u_body, newName,
                    { memory: { role: 'upgrader' } }))) {
                    console.log('Spawning new upgrader: ' + newName);
                }
            }
            if (defenders.length < nd) { //1
                var newName = 'D-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE], newName,
                    { memory: { role: 'defender' } }))) {
                    console.log('Spawning new defender: ' + newName);
                }
            }
            if (carriers.length < containers.length) {//containers.length
                var newName = 'C-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], newName,
                    { memory: { role: 'carrier' } }))) {
                    console.log('Spawning new carrier: ' + newName);
                }
            }
            if (splitters.length < ns) { //1
                var newName = 'S-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY], newName,
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
                var newName = 'H-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE, MOVE], newName,
                    { memory: { role: 'harvester' } }))) {
                    console.log('Spawning new harvester: ' + newName);
                }
            }
            if (constructionSites.length <= 0) {
                // we dont need builders
            } else {
                if (builders.length < nb) {
                    var newName = 'B-' + genUUID();
                    if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], newName,
                        { memory: { role: 'builder' } }))) {
                        console.log('Spawning new builder: ' + newName);
                    }
                }
            }
            if (upgraders.length < nu) { //
                var newName = 'U-' + genUUID();
                if (curRoom.memory.link_avail_ug) {
                    var u_body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
                }
                else {
                    var u_body = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                }
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep(u_body, newName,
                    { memory: { role: 'upgrader' } }))) {
                    console.log('Spawning new upgrader: ' + newName);
                }
            }
            if (defenders.length < nd) { //1
                var newName = 'D-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE], newName,
                    { memory: { role: 'defender' } }))) {
                    console.log('Spawning new defender: ' + newName);
                }
            }
            if (carriers.length < containers.length) {//containers.length
                var newName = 'C-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], newName,
                    { memory: { role: 'carrier' } }))) {
                    console.log('Spawning new carrier: ' + newName);
                }
            }
            if (splitters.length < ns) { //1
                var newName = 'S-' + genUUID();
                if (![ERR_BUSY, ERR_NOT_ENOUGH_ENERGY].includes(Game.spawns['spawn0'].spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY], newName,
                    { memory: { role: 'splitter' } }))) {
                    console.log('Spawning new splitter: ' + newName);
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


    if (Game.spawns['spawn0'].spawning) {
        var spawningCreep = Game.creeps[Game.spawns['spawn0'].spawning.name];
        Game.spawns['spawn0'].room.visual.text(
            '🛠️' + spawningCreep.memory.role,
            Game.spawns['spawn0'].pos.x + 1,
            Game.spawns['spawn0'].pos.y,
            { align: 'left', opacity: 0.8 });
    }

    // testing with mem clear (this is utter piss and should never be used)
    // for (var h = 0; h < harvesters.length; h++) {
    //     var harv = harvesters[h];
    //     if (harv.memory.sourceID) {
    //         harv.memory.sourceID = undefined;
    //     }
    // }
    // for (var d = 0; d < carriers.length; d++) {
    //     var del = carriers[d];
    //     if (del.memory.containerID) {
    //         del.memory.containerID = undefined;
    //     }
    // }

    // assign 1 harvestes to every source
    for (var s = 0; s < e_sources.length; s++) {
        var assigned = false;
        for (var h = 0; h < harvesters.length; h++) { if (harvesters[h].memory.sourceID == e_sources[s].id) { assigned = true; } }
        //console.log('source ' + e_sources[s].id + ' ' + assigned)
        if (!assigned) {
            for (var a = 0; a < harvesters.length; a++) { if (harvesters[a].memory.sourceID == undefined) { var harv = harvesters[a]; harv.memory.sourceID = e_sources[s].id; break; } }
        }
        // shitcode:
        // var harv = harvesters[s];
        // if (harv && !assigned) {
        //     if (harv.memory.sourceID == undefined) {
        //     harv.memory.sourceID = e_sources[s].id;
        //     }
        // }
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
                    console.log('[ERROR] unassigned carrier')
                }
            }
            else {
                var assigned = false;
                for (var a = 0; a < carriers.length; a++) { if (carriers[a].memory.containerID == containers[c].id) { assigned = true; } }
                //console.log('container ' + containers[c].id + ' ' + assigned)
                var carr = carriers[c];
                if (carr && !assigned) {
                    //if (carr.memory.containerID == undefined) {
                    carr.memory.containerID = containers[c].id;
                    //}
                }
            }
        }
    }

    // invader failsave
    if (curRoom.memory.attacked && true) {

    }

    //creep run loop
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        if (creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
            continue;
        }
        if (creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
            continue;
        }
        if (creep.memory.role == 'builder') {
            roleBuilder.run(creep);
            continue;
        }
        // safe mode is activated by curRoom.controller.activateSafeMode()
        if (creep.memory.role == 'defender') {
            roleDefender.run(creep);
            continue;
        }
        if (creep.memory.role == 'attacker') {
            roleAttacker.run(creep);
            continue;
        }
        if (creep.memory.role == 'splitter') {
            roleSplitter.run(creep);
            continue;
        }
        //carrier is run last so it will get priority on resources
        if (creep.memory.role == 'carrier') {
            roleCarrier.run(creep);
            continue;
        }
    }
}