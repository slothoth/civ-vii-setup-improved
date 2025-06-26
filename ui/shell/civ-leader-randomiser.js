import { GetCivilizationData } from '/core/ui/shell/create-panels/age-civ-select-model.js';
import { getLeaderData } from '/core/ui/shell/create-panels/leader-select-model.js';

const SPECIFIC_WEIGHTING = 3       // weights how favoured specific combos are over generics.
                                            // specific combos are multiplied so that they roughtly equal the
                                            // dynamic ones. Then SPECIFIC WEIGHTING multiplies the specific ones
export class PlayerRandomiser {
    constructor(root) {
        const ageType = GameSetup.findGameParameter('Age')?.value.value?.toString() ?? "";
        this.ageType = ageType
        this.currentCivs = new Map()
        this.LeaderMementoSynergies = Database.query('config', 'select * from LeaderMementoSynergy') ?? [];
        this.LeaderMementoSynergies = this.LeaderMementoSynergies.filter(synergy => synergy.AgeType === this.ageType)
        this.CivMementoSynergies = Database.query('config', 'select * from CivMementoSynergy') ?? [];
        this.MementoSetSynergies = Database.query('config', 'select * from MementoSetSynergy') ?? [];
        this.SpecificMementoCombos = Database.query('config', 'select * from SpecificMementoCombo') ?? [];
        this.allMementos = Database.query('config', 'select Type from Mementos').map(m => m.Type);
        this.CivLeaderPriorities = Database.query('config', 'select * from SlthLeaderCivPriorities') ?? [];


        const ageDomainMap = new Map([["AGE_ANTIQUITY", 'AntiquityAgeCivilizations'],
            ["AGE_EXPLORATION", 'ExplorationAgeCivilizations'],
            ["AGE_MODERN", 'ModernAgeCivilizations']])
        this.ageCivString = ageDomainMap.get(ageType)                  // need to have it dynamic for different ages
        const leaderData = getLeaderData();
        // this.leaderNonRandoms = this.generateLeaderData(leaderData)
        this.ExclusiveLeaders = this.generateLeaderData(leaderData)

        this.usedLeaders = this.GetInitialLeaders()
        this.civilizationData = []
        this.civilizationNonRandoms = []
        this.setToRandoms = []
        this.allPossibleCivs = []
        this.usedCivs = []
        this.doingMementos = GameSetup.findGameParameter('AiMementos')?.value.value ?? false;

        this.doLogging = false
        this.slthLog('redefining civ resolve')
    }

    doResolve(doLeaders, isAgeTransition){
        const mementoCheck = GameSetup.findGameParameter('AiMementos')?.value.value ?? false;
        const isMementoParamChanged = mementoCheck !== this.doingMementos
        this.slthLog(`memento param on?: ${mementoCheck}`)
        this.slthLog(`MementoParam diff: ${isMementoParamChanged}`)
        if (mementoCheck) {
            this.doingMementos = mementoCheck
            this.slthLog(JSON.stringify(this.usedCivs, null, 2))
            this.slthLog(JSON.stringify(this.usedLeaders, null, 2))
            if (isMementoParamChanged){
                this.slthLog(`MementoParam diff: ${isMementoParamChanged}`)
                this.usedCivs = []
                this.usedLeaders = []
            }
            if (isAgeTransition){
                this.getLockedCivData(0, true)
            }
            this.doLeaders = doLeaders
            this.isAgeTransition = isAgeTransition

            const personaLeaders = this.getLeadersInfo()
            this.generateCivInfo()

            let possibleCivUnlocked
            for (let playerId = 0; playerId < Configuration.getMap().maxMajorPlayers; ++playerId) {
                const playerConfig = Configuration.getPlayer(playerId);
                // && playerId !== GameContext.localPlayerID
                if (playerConfig.slotStatus !== SlotStatus.SS_CLOSED) {
                    if (playerId === GameContext.localPlayerID && isAgeTransition){
                        this.slthLog(`pushing ${playerConfig.civilizationTypeName} to usedCivs`)
                        this.usedCivs.push(playerConfig.civilizationTypeName)
                        continue
                    }
                    this.slthLog(`changing playerId: ${playerId}`)
                    if (isAgeTransition){
                        possibleCivUnlocked = this.getLockedCivData(playerId)
                    }
                    if (playerId !== GameContext.localPlayerID) {
                        const { newLeader, newCivType } = this.resolveRandoms(playerConfig, playerId, personaLeaders, possibleCivUnlocked, isMementoParamChanged)
                        this.slthLog(`pushing ${newCivType} to usedCivs`)
                        this.usedCivs.push(newCivType)
                        this.ExclusiveLeaders = this.ExclusiveLeaders.filter(item => item !== newLeader)
                    }
                    else {
                        const newCivType = GameSetup.findPlayerParameter(playerId, 'PlayerCivilization').value.value
                        const newLeader = GameSetup.findPlayerParameter(playerId, 'PlayerLeader').value.value
                        this.usedCivs.push(newCivType)
                        this.ExclusiveLeaders = this.ExclusiveLeaders.filter(item => item !== newLeader)
                    }
                }
            }
            // then re-iterate to find any random assigned that were manually random assigned
            for (const playerId of this.setToRandoms) {
                const availableCivs = this.allPossibleCivs.filter(ele => !(this.usedCivs.includes(ele)))
                if (availableCivs.length === 0) {
                    console.error('ERROR: No available civs left to assign! Ignoring, should be set to random')
                    continue
                }
                const randomIndex = Math.floor(Math.random() * (availableCivs.length));
                const civType = availableCivs[randomIndex];
                this.slthLog(`Setting ${playerId} to ${civType}`)
                GameSetup.setPlayerParameterValue(playerId, 'PlayerCivilization', civType);
                this.usedCivs.push(civType)
            }
        }
        else {
            // reset mementos, civs
            this.slthLog('trying to remove mementos!')
            for (let playerId = 0; playerId < Configuration.getMap().maxMajorPlayers; ++playerId) {
                const playerConfig = Configuration.getPlayer(playerId);
                if (playerConfig.slotStatus !== SlotStatus.SS_CLOSED ) {
                    if (playerId === GameContext.localPlayerID){
                        continue
                    }
                    GameSetup.setPlayerParameterValue(playerId, 'PlayerCivilization', 'RANDOM');
                    GameSetup.setPlayerParameterValue(playerId, 'PlayerLeader', 'RANDOM');
                    GameSetup.setPlayerParameterValue(playerId, 'PlayerMementoMajorSlot', 'NONE');
                    GameSetup.setPlayerParameterValue(playerId, 'PlayerMementoMinorSlot1', 'NONE');
                }
            }
            this.usedCivs = []
            this.usedLeaders = this.GetInitialLeaders()
        }
    }

    leaderCivBiasSelection(playerId, leaderType, possibleCivUnlocked, recursiveCount) {
        let newLeaderPriority
        let existingLeaderPriorityStrength
        let newLeaderPriorityStrength
        let newLeaderPriorityUnchecked = true
        if (recursiveCount > 5) {
            this.setToRandoms.push(playerId)
            return 'RANDOM'}                       // safeguard for recursive calls
        const civBiases = this.leaderToCivsMap.get(leaderType)
        this.slthLog('civBiases')
        this.slthLog(JSON.stringify(civBiases, null, 2))
        const shuffledList = this.shuffle(civBiases)
        for (const civInfo of shuffledList) {
            const civType = civInfo.CivilizationType
            const civDomain = civInfo.CivilizationDomain
            this.slthLog(`if ${civDomain} == ${this.ageCivString} we try change`)
            if (civDomain === this.ageCivString) {
                this.slthLog(`domain matched, did ${leaderType} have ${civType} unlocked? ?`)
                this.slthLog(JSON.stringify(possibleCivUnlocked, null, 2))
                if (!(possibleCivUnlocked) || possibleCivUnlocked.includes(civType)) {
                    this.slthLog(`it was, so now we check if the civ has already been used. does usedCivs contain ${civType}?`)
                    // this.slthLog(JSON.stringify(this.usedCivs, null, 2))
                    if (this.usedCivs.includes(civType)) {
                        this.slthLog('civ was used, so now into changing civs section')
                        if (playerId !== GameContext.localPlayerID) {
                            let blockerNewCiv
                            // find which leader has this civ
                            this.slthLog(`Civ biased already taken: ${civType}`)
                            this.slthLog(JSON.stringify(this.currentCivs, null, 2))
                            this.slthLog(JSON.stringify(Object.fromEntries(this.currentCivs), null, 2))
                            const blockerInfo = this.currentCivs[civType]
                            if (!blockerInfo) {
                                this.slthLog('wasnt in current civs, likely cause is human is player: so skip')
                                continue
                            }
                            const blockerLeader = blockerInfo.get('blockerLeader')
                            const blockerPlayerId = blockerInfo.get('blockerPlayerId')
                            this.slthLog(JSON.stringify(this.currentCivs[civType], null, 2))
                            this.slthLog(JSON.stringify(this.currentCivs, null, 2))
                            this.slthLog(`Civ ${civType}, leader and player Id of blocker ${blockerLeader},  ${blockerPlayerId}`)
                            if (blockerLeader === 'RANDOM') {
                                this.slthLog('blocker leader was RANDOM, so reselecting new RANDOM civ for them')
                                blockerNewCiv = this.leaderCivTrueRandomSelection(blockerLeader)
                            } else {
                                if (blockerPlayerId === GameContext.localPlayerID) {
                                    continue
                                }
                                this.slthLog(`full prios for blocker ${blockerLeader}`)
                                const existingPriorities = this.CivLeaderPriorities.filter(leader => leader.LeaderType === blockerLeader);
                                this.slthLog('existing prios')
                                this.slthLog(JSON.stringify(existingPriorities, null, 2))
                                this.slthLog('leader priority')
                                const existingLeaderPriority = existingPriorities.find(leader => leader.CivilizationType === civType)
                                this.slthLog(JSON.stringify(existingLeaderPriority, null, 2))
                                if (existingLeaderPriority) {
                                    existingLeaderPriorityStrength = existingLeaderPriority.Priority
                                } else {
                                    existingLeaderPriorityStrength = 0
                                }
                                if (newLeaderPriorityUnchecked) {
                                    newLeaderPriority = this.CivLeaderPriorities.filter(leader => leader.LeaderType === leaderType);
                                    newLeaderPriorityUnchecked = false
                                    if (!(newLeaderPriority)) {
                                        newLeaderPriorityStrength = 0
                                    } else {
                                        const newLeaderCivPriority = newLeaderPriority.find(leader => leader.CivilizationType === civType)
                                        if (newLeaderCivPriority) {
                                            newLeaderPriorityStrength = newLeaderCivPriority.Priority;
                                        } else {
                                            newLeaderPriorityStrength = 0
                                        }
                                    }
                                }
                                this.slthLog(`${blockerLeader} priority is ${existingLeaderPriorityStrength}`)
                                this.slthLog(`${leaderType} priority is ${newLeaderPriorityStrength}`)
                                if (newLeaderPriorityStrength > existingLeaderPriorityStrength) {
                                    this.slthLog(`${leaderType} had higher priority so blocker is reselected`)
                                    blockerNewCiv = this.leaderCivBiasSelection(playerId, blockerLeader, null, recursiveCount+1)
                                    this.generateNPCMementos(playerId, blockerLeader, blockerNewCiv)                    // regenerate mementos for them
                                }
                            }
                            if (blockerNewCiv) {
                                this.slthLog(`Blocker New Civilization worked, is: ${civType}`)
                                this.usedCivs.push(civType)
                                this.slthLog(`pushing ${civType} to usedCivs`)
                                GameSetup.setPlayerParameterValue(blockerPlayerId, 'PlayerCivilization', blockerNewCiv);
                                return civType
                            }
                        }
                        else {
                            this.slthLog(`Human Player civ so even when blocked we still switch to them: ${civType}`)
                            return civType;
                        }
                    }
                    else {
                        this.slthLog(`${civType} was not taken by other civs, using it for ${leaderType}. TODO: change original owner?`)
                        return civType;
                    }
                }
                else {
                    this.slthLog(`the ${civType} wasnt unlocked for ${leaderType}, new iteration`)
                }
            }
        }
        this.setToRandoms.push(playerId)                // fallback
        return 'RANDOM'
    }

    resolveRandoms(playerConfig, playerId, personaLeaders, possibleCivUnlocked, isMementoParamChanged){
        let newLeader = 'RANDOM'
        let newCivType = 'RANDOM'
        this.slthLog('personaLeaders')
        this.slthLog(JSON.stringify(personaLeaders, null, 2))
        this.slthLog(JSON.stringify(this.usedLeaders, null, 2))
        this.slthLog(playerConfig.leaderTypeName)
        if (this.doLeaders && (playerConfig.leaderTypeName === 'RANDOM' || isMementoParamChanged)) {
            newLeader = this.resolveLeader(playerId, personaLeaders)
        }
        else {
            this.slthLog(`keeping old leader: ${playerConfig.leaderTypeName}`)
            newLeader = playerConfig.leaderTypeName
            newCivType = playerConfig.civilizationTypeName
            this.currentCivs[newCivType] =  new Map([["blockerLeader", newLeader], ["blockerPlayerId", playerId]])
        }
        if (playerConfig.civilizationTypeName === 'RANDOM' || isMementoParamChanged) {
            if (this.isAgeTransition){
                const newBiasedCiv = this.leaderCivBiasSelection(playerId, newLeader, possibleCivUnlocked, 0)
                newCivType = this.resolveCiv(playerId, newLeader, newBiasedCiv)
            }
            else {
                const newBiasedCiv = this.leaderCivBiasSelection(playerId, newLeader, null, 0)
                newCivType = this.resolveCiv(playerId, newLeader, newBiasedCiv)

            }
            this.generateNPCMementos(playerId, newLeader, newCivType)
        }
        return {newLeader, newCivType}
    }

    generateNPCMementos(playerId, leaderType, civilizationType) {
        const currentPrimaryMemento = GameSetup.findPlayerParameter(playerId, 'PlayerMementoMinorSlot1').value.value
        const currentSecondaryMemento = GameSetup.findPlayerParameter(playerId, 'PlayerMementoMinorSlot1').value.value

        const validCombinations = [];


        this.slthLog(`mementos currently are: ${currentPrimaryMemento}, and ${currentSecondaryMemento}`)
        this.slthLog(`memento assignment started for ${leaderType}, ${civilizationType}`)
        this.slthLog(`All Mementos Combos length: ${this.SpecificMementoCombos.length}`)

        const matchingLeaderType = this.SpecificMementoCombos.filter(combo => combo.LeaderType === leaderType && combo.CivilizationType === null && (combo.AgeType === this.ageType || !(combo.AgeType)));
        const matchingCivilizationType = this.SpecificMementoCombos.filter(combo => combo.CivilizationType === civilizationType && combo.LeaderType === null && (combo.AgeType === this.ageType || !(combo.AgeType)));
        const matchingBothType = this.SpecificMementoCombos.filter(combo => combo.LeaderType === leaderType && combo.CivilizationType === civilizationType && (combo.AgeType === this.ageType || !(combo.AgeType)));
        const uniqueMap = new Map();
        [...matchingLeaderType, ...matchingCivilizationType, ...matchingBothType].forEach(combo => {
            const mementoEntry = {
              primary: combo.MementoTypePrimary,
              secondary: combo.MementoTypeSecondary,
              selectionType: 'Specific'
            }
            uniqueMap.set(combo.ComboID, mementoEntry);
        });

        const specificCombos = Array.from(uniqueMap.values());
        this.slthLog(`Specific Leader combo length: ${matchingLeaderType.length}`)
        this.slthLog(`Specific Civ Combo length: ${matchingCivilizationType.length}`)
        this.slthLog(`Specific Leader and Civ Combo length: ${matchingBothType.length}`)
        this.slthLog(`Specific Combo length: ${specificCombos.length}`)

        const leaderMementos = this.LeaderMementoSynergies
            .filter(synergy => synergy.LeaderType === leaderType)
            .map(synergy => synergy.MementoType);

        const civMementos = this.CivMementoSynergies
            .filter(synergy => synergy.CivilizationType === civilizationType)
            .map(synergy => synergy.MementoType);

        this.slthLog(JSON.stringify(specificCombos))
        this.slthLog(`leader memento length: ${leaderMementos.length}`)
        this.slthLog(`civ memento length: ${civMementos.length}`)
        // combine leader and civ mementos (unique values only)
        let candidatePrimaryMementos
        if  (currentPrimaryMemento !== 'NONE' && !(this.isAgeTransition)) {
            if (currentSecondaryMemento !== 'NONE') {
                return {
                    primary: currentPrimaryMemento,
                    secondary: currentSecondaryMemento,
                    selectionType: 'Predefined'
                    }
            }
          else {
            candidatePrimaryMementos = [currentPrimaryMemento]
          }
      }
      else if (currentSecondaryMemento !== 'NONE' && !(this.isAgeTransition)) {
          candidatePrimaryMementos = [currentSecondaryMemento]          // flip order, just for ease of getting another
      }
      else {
          candidatePrimaryMementos = [...new Set([...leaderMementos, ...civMementos])];
      }

      for (const primaryMemento of candidatePrimaryMementos) {
        for (const secondaryMemento of this.allMementos) {
          if (primaryMemento === secondaryMemento) continue;

          // Ensure consistent ordering for comparison with MementoSetSynergy
          const orderedPrimary = primaryMemento < secondaryMemento ? primaryMemento : secondaryMemento;
          const orderedSecondary = primaryMemento < secondaryMemento ? secondaryMemento : primaryMemento;

          // Check if there's a memento-memento synergy
          const hasMementoSynergy = this.MementoSetSynergies.some(
            synergy =>
              synergy.MementoTypePrimary === orderedPrimary &&
              synergy.MementoTypeSecondary === orderedSecondary
          );

          // Check if secondary has leader or civ synergy
          const hasLeaderSynergy = leaderMementos.includes(secondaryMemento);
          const hasCivSynergy = civMementos.includes(secondaryMemento);


          // Add to valid combinations if any synergy exists
          if (hasMementoSynergy || hasLeaderSynergy || hasCivSynergy) {
            validCombinations.push({
              primary: primaryMemento,
              secondary: secondaryMemento,
              selectionType: 'Dynamic'
            });
          }
        }
      }
      this.slthLog(`dynamic combo length: ${validCombinations.length}`)
        // we want equal amounts of dynamic vs specific ( or maybe change it with settings too). So multiply specific combos
        // so they are roughly the same amount as non specific ones.
        const dynamicToSpecificRatio = Math.floor(validCombinations.length / specificCombos.length)
        let weightedSpecificCombos = specificCombos
        if (dynamicToSpecificRatio > 1) {
            weightedSpecificCombos = specificCombos.flatMap(item => Array(dynamicToSpecificRatio * SPECIFIC_WEIGHTING).fill(item))
        }

      validCombinations.push(...weightedSpecificCombos);

      this.slthLog(`valid combo length: ${validCombinations.length}`)
      // Return a random valid combination, or null if none found
      if (validCombinations.length > 0) {
        const chosenCombo = validCombinations[Math.floor(Math.random() * validCombinations.length)];
        this.slthLog(`chosen combo for ${leaderType}, ${civilizationType} is ${JSON.stringify(chosenCombo, null, 2)}`)
        GameSetup.setPlayerParameterValue(playerId, 'PlayerMementoMajorSlot', chosenCombo['primary']);
        GameSetup.setPlayerParameterValue(playerId, 'PlayerMementoMinorSlot1', chosenCombo['secondary']);
      }
      this.slthLog(`no mementos found for primary :(`)
      return {primary: 'NONE', secondary: 'NONE', selectionType: 'Predefined'}
    }

    resolveLeader(playerId, personaLeaders) {
        const originalLeaderParameter = GameSetup.findPlayerParameter(playerId, 'PlayerLeader').value.value;
        const randomIndex = Math.floor(Math.random() * this.ExclusiveLeaders.length);
        // Use splice to remove the element at the random index
        // splice returns an array of removed elements, so we take the first one
        let newLeader = this.ExclusiveLeaders.splice(randomIndex, 1)[0];

        this.slthLog(`new leader: ${newLeader}`)
        if (personaLeaders.includes(newLeader)) {
            const nonPersonaLeader = newLeader.replace('_ALT', '');
            this.slthLog(`new leader is persona: ${newLeader}. search for non-persona leader: ${nonPersonaLeader}`)
            if (this.usedLeaders.has(nonPersonaLeader)) {
                const reRollRandomIndex = Math.floor(Math.random() * this.ExclusiveLeaders.length);
                newLeader = this.ExclusiveLeaders.splice(reRollRandomIndex, 1)[0];
                this.slthLog(`Leader was taken as persona, new leader is: ${newLeader}`)
            }
        }
        else if (personaLeaders.includes(newLeader + '_ALT')) {
            this.slthLog(`new leader is persona: ${newLeader}`)
           if (this.usedLeaders.has(newLeader + '_ALT')) {
               const reRollRandomIndex = Math.floor(Math.random() * this.ExclusiveLeaders.length);
               newLeader = this.ExclusiveLeaders.splice(reRollRandomIndex, 1)[0];
               this.slthLog(`Leader was taken as persona, new leader is: ${newLeader}`)
            }
        }
        this.usedLeaders.delete(originalLeaderParameter)
        GameSetup.setPlayerParameterValue(playerId, 'PlayerLeader', newLeader);
        this.usedLeaders.add(newLeader)

        this.slthLog(`leader changed to: ${newLeader}`)
        return newLeader
    }

    resolveCiv(playerId, newLeader, newBiasedCiv){
        let newCivType = 'RANDOM'

        if (newBiasedCiv) {
            newCivType = newBiasedCiv
        }
        else {
            const newRandomCivType = this.leaderCivTrueRandomSelection(newLeader)
            if (newRandomCivType) {
               newCivType = newRandomCivType                                    // random but exclusive
            }
            else {
                newCivType = this.civSelectionNoExclusivity(this.civilizationNonRandoms)     // true random, no exclusivity
                if (!(newCivType)) {             // fallback
                    this.setToRandoms.push(playerId)
                    newCivType = 'RANDOM'
                }
            }
        }
        GameSetup.setPlayerParameterValue(playerId, 'PlayerCivilization', newCivType);
        if (newCivType !== 'RANDOM') {
            this.currentCivs[newCivType] = new Map([["blockerLeader", newLeader], ["blockerPlayerId", playerId]])
        }
        return newCivType
    }

    generateCivInfo(){
        this.civilizationData = GetCivilizationData();
        this.civilizationNonRandoms = this.generateCivData()
        if (!(this.isAgeTransition)) {
            this.allPossibleCivs = this.generateCivData()
        }
    }

    generateCivData(){
        const civilizationOptions = []
        for (const civilization of this.civilizationData) {
            if (!civilization.isLocked && civilization.isOwned && civilization.civID !== 'RANDOM') {
                civilizationOptions.push(civilization.civID);
            }
        }
        return civilizationOptions
    }

    getLeadersInfo(){
        const personaLeaders = [];
        const leaderItemData = Database.query('config', 'select * from Leaders') ?? [];
        const LeaderTypeValues= new Set(leaderItemData.map(item => item.LeaderType));

        // Need to get all personas so they aren't together in the same game, if they ever make more than one persona of a leader we are boned here
        for (const item of leaderItemData) {
            const altValue = item.LeaderType + '_ALT';

            if (LeaderTypeValues.has(altValue)) {
              personaLeaders.push(altValue);
            }
        }

        const leaderCivBiases = (Database.query('config', 'select * from LeaderCivilizationBias') ?? []);

        const leaderToCivsMap = new Map();

        for (const element of leaderCivBiases) {
            const { LeaderType, CivilizationType, CivilizationDomain, Bias} = element;
            if (CivilizationDomain === this.ageCivString ) {
                if (leaderToCivsMap.has(LeaderType)) {
                    leaderToCivsMap.get(LeaderType).push(element);
                } else {
                    leaderToCivsMap.set(LeaderType, [element]);       // If no, create a new array with this civ
                }
            }
          }

        for (const [leaderType, civList] of leaderToCivsMap) {
            civList.sort((a, b) => b.Bias - a.Bias);
        }

        this.leaderToCivsMap = leaderToCivsMap
        return personaLeaders
    }

    generateLeaderData(leaderData){
        const leaderOptions = []
        const preSelectedLeaders = []
        for (let playerId = 0; playerId < Configuration.getMap().maxMajorPlayers; ++playerId) {
            const playerConfig = Configuration.getPlayer(playerId);
            if (playerConfig.slotStatus !== SlotStatus.SS_CLOSED && playerConfig.leaderTypeName !== 'RANDOM') {
                preSelectedLeaders.push(playerConfig.leaderTypeName);
            }
        }
        for (const leader of leaderData) {
            if (!leader.isLocked && leader.isOwned && leader.leaderID !== 'RANDOM' && !(preSelectedLeaders.includes(leader.leaderID))) {
                leaderOptions.push(leader.leaderID);
            }
        }
        return leaderOptions
    }

    getLockedCivData(playerId, firstTime){
        const playerCivilizations = GameSetup.findPlayerParameter(playerId, 'PlayerCivilization');
        const unsortedCivData = []
        if (playerCivilizations) {
            for (const civData of playerCivilizations.domain.possibleValues ?? []) {
                const civID = civData.value?.toString();
                if (!civID) {
                    continue;
                }
                const isLocked = civData.invalidReason != GameSetupDomainValueInvalidReason.Valid;
                unsortedCivData.push({civID, isLocked})
            }
        }
        const civUnrestrictedOptions = unsortedCivData.filter(civ => civ.civID !== "RANDOM")
        if (firstTime) {
            this.allPossibleCivs = civUnrestrictedOptions.map(civ => civ.civID);
        }
        return civUnrestrictedOptions.filter(civ => !(civ.isLocked)).filter(civ => !(this.usedCivs.includes(civ.civID))).map(civ => civ.civID);
    }

    GetInitialLeaders(){
        const usedLeaders = new Set();
        for (let playerId = 0; playerId < Configuration.getMap().maxMajorPlayers; ++playerId) {
            const leaderParameter = GameSetup.findPlayerParameter(playerId, 'PlayerLeader');
            this.slthLog(`init leader is ${leaderParameter.value.value}`)
            if (leaderParameter !== 'RANDOM') {
                usedLeaders.add(leaderParameter)
            }
        }
        return usedLeaders
    }

    shuffle(string_array){
        const shuffledList = [...string_array];                // do i need to reshuffle every time? maybe, as list shrinks in size
        // Shuffle the list using Fisher-Yates algorithm
        for (let i = shuffledList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledList[i], shuffledList[j]] = [shuffledList[j], shuffledList[i]];
        }
        return shuffledList
    }

    leaderCivTrueRandomSelection(){
        const randomIndex = Math.floor(Math.random() * (this.allPossibleCivs.length - this.usedCivs.length));
        return this.allPossibleCivs[randomIndex];
    }

    civSelectionNoExclusivity(civList) {
        const randomIndex = Math.floor(Math.random() * civList.length);
        return civList[randomIndex]
    }

    slthLog(msg) {
        if (this.doLogging) {
            console.error(`SLTH_LOG: ${msg}`)
        }
    }
}

