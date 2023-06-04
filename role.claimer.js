var roleClaimer = {
    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.room.controller) {
            if (!creep.room.controller.my) {
                if (creep.claimController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            } else {
                // If the controller is already claimed, remove the flag
                var flags = creep.room.find(FIND_FLAGS);
                for (var i = 0; i < flags.length; i++) {
                    flags[i].remove();
                }
            }
        } else {
            // If there's no controller, move towards the nearest flag
            var flags = Game.flags;
            var targetFlag = null;
            for (var flagName in flags) {
                var flag = flags[flagName];
                if (flag.room && !flag.room.controller) {
                    targetFlag = flag;
                    break;
                }
            }

            if (targetFlag) {
                if (creep.pos.isEqualTo(targetFlag.pos)) {
                    // If the creep is already at the flag position, remove the flag
                    targetFlag.remove();
                } else {
                    creep.moveTo(targetFlag);
                }
            }
        }
    },
};

module.exports = roleClaimer;