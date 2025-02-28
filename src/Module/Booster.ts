import {
    HeroHelper,
    ConfigHelper,
    getHHVars,
    getStoredValue,
    setStoredValue 
} from '../Helper/index';
import { gotoPage } from '../Service/index';
import { isJSON, logHHAuto, onAjaxResponse } from '../Utils/index';
import { HHStoredVarPrefixKey } from '../config/index';
import { EventGirl } from '../model/EventGirl';
import { EventModule } from './index';


const DEFAULT_BOOSTERS = {normal: [], mythic:[]};

export class Booster {
    static GINSENG_ROOT = {"id_item":"316","identifier":"B1","name":"Ginseng root", "rarity":"legendary"};
    static SANDALWOOD_PERFUME = {"id_item":"632","identifier":"MB1","name":"Sandalwood perfume","rarity":"mythic"};
    
    //all following lines credit:Tom208 OCD script  
    static collectBoostersFromAjaxResponses () {
        onAjaxResponse(/(action|class)/, (response, opt, xhr, evt) => {
                setTimeout(async function() {
                    const boosterStatus = Booster.getBoosterFromStorage();

                    const searchParams = new URLSearchParams(opt.data)
                    const mappedParams = ['action', 'class', 'type', 'id_item', 'number_of_battles', 'battles_amount'].map(key => ({[key]: searchParams.get(key)})).reduce((a,b)=>Object.assign(a,b),{})
                    const {action, class: className, type, id_item, number_of_battles, battles_amount} = mappedParams
                    const {success, equipped_booster} = response

                    if (!success) {
                        return
                    }

                    if (action === 'market_equip_booster' && type === 'booster') {
                        const idItemParsed = parseInt(id_item || '')
                        //const isMythic = idItemParsed >= 632 && idItemParsed <= 638
                        const isMythic = idItemParsed >= 632

                        const boosterData = equipped_booster

                        if (boosterData) {
                            const clonedData = {...boosterData}

                            if (isMythic) {
                                boosterStatus.mythic.push(clonedData)
                            } else {
                                boosterStatus.normal.push({...clonedData, endAt: clonedData.lifetime})
                            }

                            setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));
                            //$(document).trigger('boosters:equipped', {id_item, isMythic, new_id: clonedData.id_member_booster_equipped})
                        }
                        return
                    }

                    let mythicUpdated = false
                    let sandalwoodEnded = false;

                    let sandalwood, allMastery, leagueMastery, seasonMastery, headband, watch, cinnamon, perfume;
                    boosterStatus.mythic.forEach(booster => {
                        switch (booster.item.identifier){
                            case 'MB1':
                                sandalwood = booster;
                                break;
                                /*
                            case 'MB2':
                                allMastery = booster;
                                break;
                            case 'MB3':
                                headband = booster;
                                break;
                            case 'MB4':
                                watch = booster;
                                break;
                            case 'MB5':
                                cinnamon = booster;
                                break;
                            case 'MB7':
                                perfume = booster;
                                break;
                            case 'MB8':
                                leagueMastery = booster;
                                break;
                            case 'MB9':
                                seasonMastery = booster;
                                break;*/
                        }
                    })

                    if (sandalwood && action === 'do_battles_trolls') {
                        const isMultibattle = parseInt(number_of_battles||'') > 1
                        const {rewards} = response
                        if (rewards && rewards.data && rewards.data.shards) {
                            let drops = 0
                            rewards.data.shards.forEach(({previous_value, value}) => {
                                if (isMultibattle) {
                                    // Can't reliably determine how many drops, assume MD where each drop would be 1 shard.
                                    const shardsDropped = value - previous_value
                                    drops += Math.floor(shardsDropped/2)
                                } else {
                                    drops++
                                }
                            })
                            sandalwood.usages_remaining -= drops
                            mythicUpdated = true
                            sandalwoodEnded = sandalwood.usages_remaining <= 0;
                        }
                    }
/*
                    if (allMastery && (action === 'do_battles_leagues' || action === 'do_battles_seasons')) {
                        allMastery.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (leagueMastery && (action === 'do_battles_leagues')) {
                        leagueMastery.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (seasonMastery && (action === 'do_battles_seasons')) {
                        seasonMastery.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (headband && (action === 'do_battles_pantheon' || action === 'do_battles_trolls')) {
                        headband.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (watch && className === 'TeamBattle') {
                        watch.usages_remaining -= parseInt(battles_amount)
                        mythicUpdated = true
                    }

                    if (cinnamon && action === 'do_battles_seasons') {
                        cinnamon.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (perfume && action === 'start' && className === 'TempPlaceOfPower') {
                        perfume.usages_remaining--
                        mythicUpdated = true
                    }
*/
                    boosterStatus.mythic = boosterStatus.mythic.filter(({usages_remaining}) => usages_remaining > 0)

                    setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));

                    /*if (mythicUpdated) {
                        $(document).trigger('boosters:updated-mythic')
                    }*/

                    try{
                        if (sandalwood && mythicUpdated && sandalwoodEnded) {
                            const isMultibattle = parseInt(number_of_battles||'') > 1
                            logHHAuto("sandalwood may be ended need a new one");
                            if (getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythic") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood") === "true" && EventModule.getEventMythicGirl().is_mythic) {
                                if (isMultibattle) {
                                    // TODO go to market if sandalwood not ended, continue. If ended, buy a new one
                                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
                                }
                            }
                        }
                    } catch(err) {
                        logHHAuto('Catch error during equip sandalwood for mythic' + err);
                    }
                }, 200);
        })
    }

    static needBoosterStatusFromStore() {
        const isMythicAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood") === "true";
        const isLeagueWithBooster = getStoredValue(HHStoredVarPrefixKey+"Setting_autoLeaguesBoostedOnly") === "true";
        const isSeasonWithBooster = getStoredValue(HHStoredVarPrefixKey+"Setting_autoSeasonBoostedOnly") === "true";
        const isPantheonWithBooster = getStoredValue(HHStoredVarPrefixKey+"Setting_autoPantheonBoostedOnly") === "true";
        return isLeagueWithBooster || isSeasonWithBooster || isPantheonWithBooster || isMythicAutoSandalWood;
    }

    static getBoosterFromStorage(){
        return isJSON(getStoredValue(HHStoredVarPrefixKey+"Temp_boosterStatus"))?JSON.parse(getStoredValue(HHStoredVarPrefixKey+"Temp_boosterStatus")):DEFAULT_BOOSTERS;
    }

    static haveBoosterEquiped(boosterCode:string='') {
        const boosterStatus = Booster.getBoosterFromStorage();
        const serverNow = getHHVars('server_now_ts');
        if(boosterCode == '') {
            // have at least one
            return /*boosterStatus.mythic.length > 0 ||*/ boosterStatus.normal.some((booster) => booster.endAt > serverNow)
        }else {
            return boosterStatus.mythic.some((booster) => booster.item.identifier === boosterCode)
            || boosterStatus.normal.some((booster) => booster.item.identifier === boosterCode && booster.endAt > serverNow) 
        }
    }

    static collectBoostersFromMarket() {
        const activeSlots = $('#equiped .booster .slot:not(.empty):not(.mythic)').map((i, el)=> $(el).data('d')).toArray()
        const activeMythicSlots = $('#equiped .booster .slot:not(.empty).mythic').map((i, el)=> $(el).data('d')).toArray()

        const boosterStatus = {
            normal: activeSlots.map((data) => ({...data, endAt: getHHVars('server_now_ts') + data.expiration})),
            mythic: activeMythicSlots,
        }

        setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));
    }

    static needSandalWoodEquipped(nextTrollChoosen: number): boolean {
        const eventGirl: EventGirl = EventModule.getEventMythicGirl();
        const activated = getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythic") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood") === "true";
        const correctTrollTargetted = eventGirl.is_mythic && eventGirl.troll_id == nextTrollChoosen;
        const ownedSandalwood = HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_PERFUME.identifier);
        if (activated && correctTrollTargetted && !Booster.haveBoosterEquiped(Booster.SANDALWOOD_PERFUME.identifier) && ownedSandalwood) {
            const remainingShards = Number(100 - Number(eventGirl.shards));
            if (remainingShards > 10) {
                return true;
            } else {
                logHHAuto("Less than 10 shards, do not equip Sandalwood to avoid loss");
            }
        }
        return false;
    }

    static async equipeSandalWoodIfNeeded(nextTrollChoosen:number):Promise<boolean>{
        try {
            if(Booster.needSandalWoodEquipped(nextTrollChoosen)) {
                // Equip a new one
                const equiped: boolean = await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
                if (!equiped) {
                    const numberFailure = HeroHelper.getSandalWoodEquipFailure();
                    if (numberFailure >= 3) {
                        logHHAuto("Failure when equip Sandalwood for mythic for the third time, deactivated auto sandalwood");
                        setStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood", 'false');

                    } else logHHAuto("Failure when equip Sandalwood for mythic");
                }
                return equiped;
            }
        } catch (error) {
            return Promise.resolve(false);
        }
        return Promise.resolve(false);
    }
}