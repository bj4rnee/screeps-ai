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
  
        if (Object.keys(flags).length > 0) {
          // Move towards the nearest flag
          var targetFlag = creep.pos.findClosestByRange(FIND_FLAGS);
          if (targetFlag) {
            if (creep.pos.isEqualTo(targetFlag.pos)) {
              // If the creep is already at the flag position, remove the flag and move to the next flag
              targetFlag.remove();
            } else {
              creep.moveTo(targetFlag);
            }
          }
        }
      }
    },
  };
  
  module.exports = roleClaimer;