var roleClaimer = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // If the current room is not claimed
        if (!creep.room.controller || !creep.room.controller.my) {
            if (creep.claimController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        } else {
            // If the current room is claimed
            var flags = Game.flags;
            var targetFlag = null;
            for (var flagName in flags) {
                var flag = flags[flagName];
                if (Game.rooms[flag.pos.roomName]) { // !flag.room.controller
                    targetFlag = flag;
                    break;
                }
            }

            if (targetFlag) {
                if (creep.pos.isEqualTo(targetFlag.pos)) {
                    // If the creep is already at the flag position, remove the flag and move to the next flag
                    targetFlag.remove();
                } else {
                    creep.moveTo(targetFlag);
                }
            }
        }
    },
};

module.exports = roleClaimer;