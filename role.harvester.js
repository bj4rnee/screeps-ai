var roleHarvester = {

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.store[RESOURCE_ENERGY] <= 0) {
            creep.memory.harvesting = true;
        }
        // full energy -> transfer
        if (creep.store.getFreeCapacity() <= 0) {
            creep.memory.harvesting = false;
        }
        if (creep.room.memory.stage < 2) { //creep.room.memory.stage < 2
            //even in stage 1 harvesters are alway harvesting...
            creep.memory.harvesting = true;

            // no energy -> collect
            if (creep.memory.harvesting && creep.memory.sourceID) {
                var sources = creep.room.find(FIND_SOURCES_ACTIVE);
                var closestSource = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                var assigned_source = Game.getObjectById(creep.memory.sourceID);
                if (creep.harvest(assigned_source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(assigned_source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
            // transfer
            else {
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_TOWER) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                //for(let i = 0; i < targets.length; i++){
                if (targets.length > 0) {
                    if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
                // no target -> go to spawn
                else {
                    creep.memory.harvesting = true;
                    creep.moveTo(Game.spawns['spawn0'], { visualizePathStyle: { stroke: '#ffffff' } });
                }

                // if(targets.length > 1 && creep.store[RESOURCE_ENERGY] > 0){
                //     // go to another target and fill it
                //     if(creep.transfer(targets[1], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                //     creep.moveTo(targets[1], {visualizePathStyle: {stroke: '#ffffff'}});
                // }
                // }
                //}
            }

            //room is in stage 2
        } else {
            //creep in this stage is always harvesting (and never carrying)
            creep.memory.harvesting = true;

            // no energy -> harvest from assigned source
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_CONTAINER); // TODO check if freecapacity restraint is needed
                }
            });
            var target = creep.pos.findClosestByPath(targets);
            if (creep.memory.harvesting && creep.memory.sourceID) {
                //var source = creep.room.find(creep.memory.sourceID);
                var assigned_source = Game.getObjectById(creep.memory.sourceID);
                if (creep.harvest(assigned_source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(assigned_source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                var closest_container_by_source = assigned_source.pos.findClosestByRange(targets);
                //always call move so that creep stands on container
                if (closest_container_by_source) {
                    creep.moveTo(closest_container_by_source, { visualizePathStyle: { stroke: '#cc00ff' } });
                }
            }
            // transfer
            else {
                if (targets.length > 0) {
                    // always call move so that creep stands on container
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#cc00ff' } });
                    if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
                // no target -> do nothing
                else {
                    creep.memory.harvesting = true;
                }
            }
        }
    }
};

module.exports = roleHarvester;