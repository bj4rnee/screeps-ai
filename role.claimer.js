var roleClaimer = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // check if the creep has an assigned flag or room
        if (!creep.memory.targetFlag || !creep.memory.targetRoom) {
            var flags = Object.values(Game.flags);
            var uniqueFlags = flags.filter((flag) => !flags.some((f) => f !== flag && f.pos.roomName === flag.pos.roomName));
            var targetFlag = uniqueFlags.find((flag) => !Game.rooms[flag.pos.roomName]);
            if (targetFlag) {
                // Assign the flag and its room to the creep
                creep.memory.targetFlag = targetFlag.name;
                creep.memory.targetRoom = targetFlag.pos.roomName;
            }
        }

        // If the creep is in its target room
        if (creep.room.name === creep.memory.targetRoom) {
            // If the current room is not claimed
            if (!creep.room.controller || !creep.room.controller.my) {
                if (creep.claimController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#cc00cc' } });
                }
            } else {
                // If the claim was successful, remove the flag
                if (creep.room.controller && creep.room.controller.my) {
                    var targetFlag = Game.flags[creep.memory.targetFlag];
                    if (targetFlag) {
                        targetFlag.remove();
                        delete creep.memory.targetFlag; // Remove the flag from the creep's memory
                    }
                }

                // Perform tasks in the target room
                // Check if the claimer should switch between upgrading and collecting energy
                if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
                    creep.memory.upgrading = false;
                }
                if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
                    creep.memory.upgrading = true;
                }

                // Upgrade the controller if in upgrading mode
                if (creep.memory.upgrading) {
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#cc00cc' } });
                    }
                }
                // Collect energy if in collecting mode
                else {
                    // Look for dropped energy in the room
                    var droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                        filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0
                    });

                    // If there is dropped energy, collect it
                    if (droppedEnergy.length > 0) {
                        if (creep.pickup(droppedEnergy[0]) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(droppedEnergy[0], { visualizePathStyle: { stroke: '#cc00cc' } });
                        }
                    }
                }
            }
        } else {
            // Move towards the assigned flag's position
            var targetFlag = Game.flags[creep.memory.targetFlag];
            if (targetFlag) {
                creep.moveTo(targetFlag, { visualizePathStyle: { stroke: '#cc00cc' } });
            }
        }
    },
};

module.exports = roleClaimer;