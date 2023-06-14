import axios from 'axios';
import snoowrap from 'snoowrap';
import { InboxStream, CommentStream, SubmissionStream } from "snoostorm";;
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from "openai";
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'json2csv';

const DEBUG_STRING = ""

dotenv.config();

function generateFooter(weapons) {
  const polehammerLink = "https://polehammer.net?" + weaponQueryParam(weapons);

  var phNetBlurb = ""
  if(weapons.length === 1) 
    phNetBlurb = `[Here you can view the stats of the ${weapons[0].name}.](${polehammerLink})`
  else {
    phNetBlurb = `You can see a visual comparison between the mentioned weapons [here](${polehammerLink}).`
  }

  return `${phNetBlurb}\n\n^(I am a bot.  Valid keywords are found [here](https://github.com/Chiv2-Community/PolehammerPoster/blob/main/keywords.md). You can get my attention at any time by mentioning me by name. Learn more [here](https://github.com/Chiv2-Community/PolehammerPoster/blob/main/whoami.md). This bot uses unofficial data and is not affiliated with Torn Banner in any way.)`
}

// Load API credentials from environment variables
const { CLIENT_ID, CLIENT_SECRET, REDDIT_USER, REFRESH_TOKEN, USER_AGENT, GITHUB_TOKEN, OPENAI_API_KEY} = process.env;

// Initialize Reddit API client
const reddit = new snoowrap({
  userAgent: USER_AGENT,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  refreshToken: REFRESH_TOKEN,
  username: REDDIT_USER,
});

const openAiConfiguration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(openAiConfiguration);


function adaptKeywords(keywords) {
  const lowercaseKeywords = keywords.map(x => x.toLowerCase());
  return [...new Set(lowercaseKeywords.flatMap(kw => [kw.replaceAll(" ", ""), kw]))];
}

const classGroups = {
  "archer": ["skirmisher", "crossbowman", "longbowman"],
  "vanguard": ["devastator", "ambusher", "raider"], 
  "footman": ["poleman", "man at arms", "engineer"], 
  "knight": ["officer", "guardian", "crusader"]
};

const subclassKeywords = Object.values(classGroups).flat();
const classKeywords = Object.keys(classGroups);

const damageTypes = ["Cut", "Blunt", "Chop"];

const subredditName = 'Chivalry2';

async function fetchKeywordsFromGithub() {
  const githubApiUrl = 'https://api.github.com/repos/Jacoby6000/polehammer/contents/src/weapons';
  const githubRawBaseUrl = 'https://raw.githubusercontent.com/Jacoby6000/polehammer/main/src/weapons';

  let weaponsMap = {};

  try {
    // Fetch the list of files in the directory
    const fileListResponse = await axios.get(githubApiUrl, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });
    const fileList = fileListResponse.data;

    // Filter JSON files
    const jsonFiles = fileList.filter((file) => file.name.endsWith('.json'));

    // Fetch and process each JSON file
    for (const file of jsonFiles) {
      try {
        console.log(`Fetching JSON file from GitHub: ${file.name}`);
        const response = await axios.get(`${githubRawBaseUrl}/${file.name}`);
        const weapon = response.data;

        if (!weapon.hasOwnProperty("id")) {
          console.log(`Weapon data in ${file.name} is incomplete.  Skipping...`);
          continue;
        }

        weaponsMap[weapon.id] = weapon;
        weapon.keywords = [];
        weapon.keywords.push(weapon.name.toLowerCase());

        weapon.classes = weapon.weaponTypes.map(x => x.toLowerCase()).filter(x => classKeywords.includes(x))
        weapon.subclasses = weapon.weaponTypes.map(x => x.toLowerCase()).filter(x => subclassKeywords.includes(x))
        weapon.weaponTypes.forEach(weaponType => {
          weapon.keywords.push(weaponType);
        });
        if(weapon.hasOwnProperty("aliases")) {
          weapon.aliases.forEach((alias) => {
            weapon.keywords.push(alias.toLowerCase());
          });
        } else {
          weapon.aliases = [];
        }

        weapon.aliases.push(weapon.name);
        weapon.aliases = adaptKeywords(weapon.aliases);

        weapon.keywords.push(weapon.damageType);
        if(weapon.keywords.includes("Two Handed")) {
          weapon.keywords.push("2h");
          weapon.keywords.push("2 hander");
          weapon.keywords.push("two hander");
        } else if(weapon.keywords.includes("One Handed")) {
          weapon.keywords.push("1h");
          weapon.keywords.push("1 hander");
          weapon.keywords.push("one hander");
        }

        weapon.keywords = adaptKeywords(weapon.keywords);

      } catch (error) {
        console.error(`Error fetching JSON file from GitHub`);
        console.error(error);
      }
    }
  } catch (error) {
    console.error(`Error fetching file list from GitHub: ${error}`);
  }


  return weaponsMap;
}

function addAveragesToWeapons(weaponsMap) {
  Object.keys(weaponsMap).forEach((key) => {
    const weapon = weaponsMap[key];
    weapon.average = {
      range: ((weapon.attacks.slash.range + weapon.attacks.overhead.range + weapon.attacks.stab.range) / 3),
      altRange: ((weapon.attacks.slash.altRange + weapon.attacks.overhead.altRange + weapon.attacks.stab.altRange) / 3),
      lightDamage: ((weapon.attacks.slash.light.damage + weapon.attacks.overhead.light.damage + weapon.attacks.stab.light.damage) / 3),
      heavyDamage: ((weapon.attacks.slash.heavy.damage + weapon.attacks.overhead.heavy.damage + weapon.attacks.stab.heavy.damage) / 3),
      windup: ((weapon.attacks.slash.light.windup + weapon.attacks.overhead.light.windup + weapon.attacks.stab.light.windup) / 3),
    }
  });
}

function averageDamageMultiplier(type) {
  if(type === "Chop") {
    return (1 + 1 + 1.175 + 1.25) / 4
  } else if (type === "Blunt") {
    return (1 + 1 + 1.35 + 1.5) / 4
  } else if (type === "Cut") {
    return 1
  } else throw new Error("Unknown damage type: " + type);
}


/*
function addAveragePercentilesToWeapons(weaponsMap) {
  const allWeapons = Object.values(weaponsMap)

  const sortedByLightDamage = allWeapons.slice().sort((a, b) => 
    (a.average.lightDamage * averageDamageMultiplier(a.damageType)) - 
    (b.average.lightDamage * averageDamageMultiplier(b.damageType))
  ).map(x => x.id);

  const sortedByHeavyDamage = allWeapons.slice().sort((a, b) =>
    (a.average.heavyDamage * averageDamageMultiplier(a.damageType)) - 
    (b.average.heavyDamage * averageDamageMultiplier(b.damageType))
  ).map(x => x.id);

  const sortedByWindup = allWeapons.slice().sort((a, b) =>
    b.average.windup - a.average.windup
  ).map(x => x.id);

  var sortedByAverageRange = allWeapons.slice().sort((a, b) =>
    ((a.average.range + a.average.altRange) / 2) - 
    ((b.average.range + b.average.altRange) / 2)
  );
  sortedByAverageRange = sortedByAverageRange.map(x => x.id);


  function toPercentile(id, sortedIds) {
    return (sortedIds.indexOf(id) / sortedIds.length) * 100;
  }

  Object.keys(weaponsMap).forEach((key) => {
    const rangePercentile = toPercentile(key, sortedByAverageRange);
    const lightDamagePercentile = toPercentile(key, sortedByLightDamage);
    const heavyDamagePercentile = toPercentile(key, sortedByHeavyDamage);
    const windupPercentile = toPercentile(key, sortedByWindup);

    weaponsMap[key].percentile = {
      range: rangePercentile,
      lightDamage: lightDamagePercentile,
      heavyDamage: heavyDamagePercentile,
      windup: windupPercentile,
      average: (rangePercentile + lightDamagePercentile + heavyDamagePercentile + windupPercentile) / 4
    };
  });
}
*/

function weaponQueryParam(weapons) {
  var str = "weapon=";
  for (var i = 0; i < weapons.length; i++) {
    str += weapons[i].id + "-";
  }

  return str.slice(0, -1);
}
    
function weaponTextList(weapons) {
  var str = "";
  for (var i = 0; i < weapons.length; i++) {
    if(i == weapons.length - 1) 
      str += "and " + weapons[i].name
    else if(weapons.length >= 3)
      str += weapons[i].name + ", ";
    else
      str += weapons[i].name + " ";
  }

  return str
}

const systemPrompt = readFileSync("system-prompt.txt").toString();
const classifierPrompt = readFileSync("comment-classifier.txt").toString();

function generateCsv(weapons) {
  const processedWeapons = weapons.map(weapon => {
    const damageMultiplierFootman = weapon.damageType === 'Chop' ? 1.175 : weapon.damageType === 'Blunt' ? 1.35 : 1;
    const damageMultiplierKnight = weapon.damageType === 'Chop' ? 1.25 : weapon.damageType === 'Blunt' ? 1.5 : 1;

    return {
      name: weapon.name,
      classes: weapon.classes.join(', '),
      subclasses: weapon.subclasses.join(', '),
      damageType: weapon.damageType,
      handedness: weapon.weaponTypes.includes('One Handed') ? 'One Handed' : 'Two Handed',
      averageRange: weapon.attacks.average.range.toFixed(1).replace(/\.0+$/, ''),
      averageAltRange: weapon.attacks.average.altRange.toFixed(1).replace(/\.0+$/, ''),
      averageLightWindup: weapon.attacks.average.light.windup.toFixed(1).replace(/\.0+$/, ''),
      averageLightRelease: weapon.attacks.average.light.release.toFixed(1).replace(/\.0+$/, ''),
      averageLightRecovery: weapon.attacks.average.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      averageLightCombo: weapon.attacks.average.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      averageLightDamage: weapon.attacks.average.light.damage.toFixed(1).replace(/\.0+$/, ''),
      averageHeavyWindup: weapon.attacks.average.heavy.windup.toFixed(1).replace(/\.0+$/, ''),
      averageHeavyRelease: weapon.attacks.average.heavy.release.toFixed(1).replace(/\.0+$/, ''),
      averageHeavyRecovery: weapon.attacks.average.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      averageHeavyCombo: weapon.attacks.average.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      averageHeavyDamage: weapon.attacks.average.heavy.damage.toFixed(1).replace(/\.0+$/, ''),
      slashRange: weapon.attacks.slash.range.toFixed(1).replace(/\.0+$/, ''),
      slashAltRange: weapon.attacks.slash.altRange.toFixed(1).replace(/\.0+$/, ''),
      slashLightWindup: weapon.attacks.slash.light.windup.toFixed(1).replace(/\.0+$/, ''),
      slashLightRelease: weapon.attacks.slash.light.release.toFixed(1).replace(/\.0+$/, ''),
      slashLightRecovery: weapon.attacks.slash.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      slashLightCombo: weapon.attacks.slash.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      slashLightDamage: weapon.attacks.slash.light.damage.toFixed(1).replace(/\.0+$/, ''),
      slashHeavyWindup: weapon.attacks.slash.heavy.windup.toFixed(1).replace(/\.0+$/, ''),
      slashHeavyRelease: weapon.attacks.slash.heavy.release.toFixed(1).replace(/\.0+$/, ''),
      slashHeavyRecovery: weapon.attacks.slash.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      slashHeavyCombo: weapon.attacks.slash.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      slashHeavyDamage: weapon.attacks.slash.heavy.damage.toFixed(1).replace(/\.0+$/, ''),
      overheadRange: weapon.attacks.overhead.range.toFixed(1).replace(/\.0+$/, ''),
      overheadAltRange: weapon.attacks.overhead.altRange.toFixed(1).replace(/\.0+$/, ''),
      overheadLightWindup: weapon.attacks.overhead.light.windup.toFixed(1).replace(/\.0+$/, ''),
      overheadLightRelease: weapon.attacks.overhead.light.release.toFixed(1).replace(/\.0+$/, ''),
      overheadLightRecovery: weapon.attacks.overhead.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      overheadLightCombo: weapon.attacks.overhead.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      overheadLightDamage: weapon.attacks.overhead.light.damage.toFixed(1).replace(/\.0+$/, ''),
      overheadHeavyWindup: weapon.attacks.overhead.heavy.windup.toFixed(1).replace(/\.0+$/, ''),
      overheadHeavyRelease: weapon.attacks.overhead.heavy.release.toFixed(1).replace(/\.0+$/, ''),
      overheadHeavyRecovery: weapon.attacks.overhead.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      overheadHeavyCombo: weapon.attacks.overhead.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      overheadHeavyDamage: weapon.attacks.overhead.heavy.damage.toFixed(1).replace(/\.0+$/, ''),
      stabRange: weapon.attacks.stab.range.toFixed(1).replace(/\.0+$/, ''),
      stabAltRange: weapon.attacks.stab.altRange.toFixed(1).replace(/\.0+$/, ''),
      stabLightWindup: weapon.attacks.stab.light.windup.toFixed(1).replace(/\.0+$/, ''),
      stabLightRelease: weapon.attacks.stab.light.release.toFixed(1).replace(/\.0+$/, ''),
      stabLightRecovery: weapon.attacks.stab.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      stabLightCombo: weapon.attacks.stab.light.recovery.toFixed(1).replace(/\.0+$/, ''),
      stabLightDamage: weapon.attacks.stab.light.damage.toFixed(1).replace(/\.0+$/, ''),
      stabHeavyWindup: weapon.attacks.stab.heavy.windup.toFixed(1).replace(/\.0+$/, ''),
      stabHeavyRelease: weapon.attacks.stab.heavy.release.toFixed(1).replace(/\.0+$/, ''),
      stabHeavyRecovery: weapon.attacks.stab.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      stabHeavyCombo: weapon.attacks.stab.heavy.recovery.toFixed(1).replace(/\.0+$/, ''),
      stabHeavyDamage: weapon.attacks.stab.heavy.damage.toFixed(1).replace(/\.0+$/, ''),
      throwWindup: weapon.attacks.throw.windup.toFixed(1).replace(/\.0+$/, ''),
      throwRelease: weapon.attacks.throw.release.toFixed(1).replace(/\.0+$/, ''),
      throwRecovery: weapon.attacks.throw.recovery.toFixed(1).replace(/\.0+$/, ''),
      throwDamage: weapon.attacks.throw.damage.toFixed(1).replace(/\.0+$/, ''),
      specialAttackWindup: weapon.attacks.special.windup.toFixed(1).replace(/\.0+$/, ''),
      specialAttackRelease: weapon.attacks.special.release.toFixed(1).replace(/\.0+$/, ''),
      specialAttackRecovery: weapon.attacks.special.recovery.toFixed(1).replace(/\.0+$/, ''),
      specialAttackDamage: weapon.attacks.special.damage.toFixed(1).replace(/\.0+$/, ''),
      sprintAttackWindup: weapon.attacks.sprintAttack.windup.toFixed(1).replace(/\.0+$/, ''),
      sprintAttackRelease: weapon.attacks.sprintAttack.release.toFixed(1).replace(/\.0+$/, ''),
      sprintAttackCombo: weapon.attacks.sprintAttack.combo.toFixed(1).replace(/\.0+$/, ''),
      sprintAttackDamage: weapon.attacks.sprintAttack.damage.toFixed(1).replace(/\.0+$/, ''),
      damageMultiplierFootman: damageMultiplierFootman.toString().replace(/\.0+$/, ''),
      damageMultiplierKnight: damageMultiplierKnight.toString().replace(/\.0+$/, ''),
    };
  });
  const fields = Object.keys(processedWeapons[0]);

  const opts = { fields };
  return parse(processedWeapons, opts);
}

function generateReply(aiResponse, weapons) {

  return `${aiResponse}

___

${generateFooter(weapons)}`
}

async function findCommentChain(childComment) {
  if(!childComment.hasOwnProperty("parent_id") || !childComment.parent_id.startsWith("t1_")) 
    return [childComment];

  function findCommentChainRecursive(comment, targetId) {
    if (comment.id === targetId) {
      return [comment];
    }

    for (const reply of comment.replies) {
      const chain = findCommentChainRecursive(reply, targetId);
      if (chain) {
        return [comment, ...chain];
      }
    }

    return null;
  }

  const linkId = childComment.link_id;
  return reddit
    .getSubmission(linkId.slice(3))
    .expandReplies({limit: Infinity, depth: Infinity})
    .then(submission => {
      for (const topLevelComment of submission.comments) {
        const result = findCommentChainRecursive(topLevelComment, childComment.id);
        if(result) {
          result.unshift(submission);
          return result;
        }
      }

      return [submission];
    });
}

function getMyComments() {
  return JSON.parse(readFileSync("cache/myComments.json").toString());
}

function updateMyComments(commentIds) {
  writeFileSync('cache/myComments.json', JSON.stringify(commentIds));
}

function getRepliedTo() {
  return JSON.parse(readFileSync("cache/repliedTo.json").toString());
}

function getBanlist() {
  return JSON.parse(readFileSync("cache/banlist.json").toString()).map(x => x.toLowerCase());
}

function updateRepliedTo(commentIds) {
  writeFileSync('cache/repliedTo.json', JSON.stringify(commentIds));
}

async function initialize() {
  try {
    const myComments = getMyComments();
    const repliedTo = getRepliedTo();
    const banlist = getBanlist();
    const weaponsMap = await fetchKeywordsFromGithub();
    //addAveragesToWeapons(weaponsMap);
    //addAveragePercentilesToWeapons(weaponsMap);
    const ignoreWords = [] // ["cavalry sword", "calvary sword"]
    const allKeywords = getAllKeywords(weaponsMap);
    const weaponAliases = getAllWeaponAliases(weaponsMap);
    const subreddit = await reddit.getSubreddit(subredditName);

    const weapons = Object.values(weaponsMap)
    // weapons.sort((a, b) => a.percentile.average - b.percentile.average);

    writeKeywordsMD(weaponsMap, allKeywords);

    processSubredditItems(subreddit, myComments, repliedTo, allKeywords, weaponAliases, weaponsMap, ignoreWords, banlist);
  } catch (error) {
    console.error(`Error setting up connection: ${error}`);
    console.log(error);
  }
}

function writeKeywordsMD(weaponsMap, allKeywords) {
    const keywordsMap = {}
    allKeywords.forEach(k => { 
      keywordsMap[k] = getWeaponsFromKeyword(k, weaponsMap).map(w => w.name)
    });

    let markdownString = "| Keyword | Weapons |\n|---------|----------|\n";

    const keys = Object.keys(keywordsMap);
    keys.sort();
    keys.forEach(k => {
      markdownString += `| ${k} | ${keywordsMap[k].join(", ")} |\n`;
    });

    writeFileSync('keywords.md', markdownString);
}

function getAllKeywords(weaponsMap) {
  const allKeywords = Object.values(weaponsMap).map((w) => w.keywords).flat();
  allKeywords.sort((a, b) => b.length - a.length);

  return [...new Set(allKeywords)];
}

function getAllWeaponAliases(weaponsMap) {
  const weaponAliases = 
    Object
      .values(weaponsMap)
      .flatMap(w => [w.aliases, w.name])
      .flat()
      .filter(x => x);

  weaponAliases.sort((a, b) => b.length - a.length);

  return [...new Set(adaptKeywords(weaponAliases))];
}

function getWeaponsFromKeyword(keyword, weaponsMap) {
  return Object.values(weaponsMap).filter(weapon => weapon.keywords.includes(keyword));
}

function getWeaponFromAlias(alias, weaponsMap) {
  return Object.values(weaponsMap).find(weapon => weapon.aliases.includes(alias));
}

function getWeaponsFromAliases(aliases, weaponsMap) {
  return [...new Set(aliases.map(a => getWeaponFromAlias(a, weaponsMap)).map(x => x.id))].map(id => weaponsMap[id]);
}

function getWeaponsFromKeywords(keywords, weaponsMap) {
  return [...new Set(keywords.flatMap(kw => getWeaponsFromKeyword(kw, weaponsMap)).map(x => x.id))].map(id => weaponsMap[id]);
}

function getWeaponsFromClass(cls, weaponsMap) {
  return Object.values(weaponsMap).filter(weapon => weapon.classes.includes(cls));
}

function getWeaponsFromClasses(classes, weaponsMap) {
  return [...new Set(classes.flatMap(c => getWeaponsFromClass(c, weaponsMap)).map(x => x.id))].map(id => weaponsMap[id]);
}

function getWeaponsFromSubclass(subclass, weaponsMap) {
  return Object.values(weaponsMap).filter(weapon => weapon.subclasses.includes(subclass));
}

function getWeaponsFromSubclasses(subclasses, weaponsMap) {
  return [...new Set(subclasses.flatMap(c => getWeaponsFromSubclass(c, weaponsMap)).map(x => x.id))].map(id => weaponsMap[id]);
}


function findAllKeywords(body, allKeywords) {
  let localBody = body.replaceAll("-", " ");
  return allKeywords.filter((keyword) => {
    if(localBody.includes(keyword)) {
      localBody = localBody.replaceAll(keyword, "");
      return true;
    } else {
      return false;
    }
  });
}

function replaceAliasesWithWeaponNames(foundAliases, body, weaponsMap) {
  let localBody = body
  foundAliases.forEach(alias => {
    if(localBody.includes(alias)) {
      localBody = localBody.replaceAll(alias, `"${getWeaponFromAlias(alias, weaponsMap).name}"`);
    }
  });
  return localBody;
}

async function processSubredditItems(subreddit, myComments, repliedTo, allKeywords, weaponAliases, weaponsMap, ignoreWords, banlist) {
  const processItem = async (item) => {
    try {
      var body = ""
      if(item.hasOwnProperty("body"))
        body = item.body.toLowerCase();
      else 
        body += `#${item.title.toLowerCase()}\n\n${item.selftext.toLowerCase() ? item.selftext.toLowerCase() : ""}`;

      body += DEBUG_STRING

      const ignore = ignoreWords.some((word) => body.includes(word));
      const banned = banlist.includes(item.author.name.toLowerCase());
      const parentId = item.parent_id ? item.parent_id.slice(3) : "nul"

      // exit early if we've already seen this post, it contains specific ignore keywords, or if it is one of our own posts.
      if(ignore || item.author.name.toLowerCase().includes(REDDIT_USER.toLowerCase()) || item.saved) return;
      
      const replyingToMe = myComments.includes(parentId) || body.includes(REDDIT_USER.toLowerCase() || body.includes("polehammer poster"));
      const mentionedWeaponAliases = findAllKeywords(body, weaponAliases);


      console.log(`-------------------------------`);
      console.log(`[${item.id}] Found directly referenced weapons: ${mentionedWeaponAliases}`);

      if(banned) {
        console.log(`[${item.id}] Ignoring post from banned user: ${item.author.name}`);
        return;
      }


      if(!replyingToMe) {
        if (mentionedWeaponAliases.length <= 1) {
          console.log(`[${item.id}] Not enough weapons mentioned`);
          return;
        }
        if (!(await comparisonRequested(body))) {
          console.log(`[${item.id}] No Comparison requested`);
          return;
        }
        console.log(`[${item.id}] Comparison requested`);
      } else {
        console.log(`[${item.id}] Replied to me`);
      }

      const fullCommentChain = await findCommentChain(item)      
      const repliedAlready = fullCommentChain.some(c => repliedTo.includes(c.id))

      // exit early if we've already replied to this chain, unless I am mentioned or replied to
      if(repliedAlready && !replyingToMe) {
        console.log(`[${item.id}] Already replied to this chain`);
        return;
      }

      const commentChain = fullCommentChain.slice(-5);
      const chainKeywords = getKeywordsFromCommentChain(commentChain, allKeywords);
      const weaponsFromAliases = getWeaponsFromAliases(mentionedWeaponAliases, weaponsMap);

      const weapons = 
        [...new Set(getWeaponsFromKeywords(chainKeywords, weaponsMap)
                  .concat([weaponsMap["ph"]])
                  .map(x => x.id))
        ].map(id => weaponsMap[id]);


      const userMessages = generateUserMessages(commentChain, mentionedWeaponAliases, weaponsMap);

      var done = false;
      var removeMessages = 0;
      while(!done) {
        try {
          const replyObject = 
            await generateAndSendReply(
              item, 
              chainKeywords, 
              weapons, 
              userMessages.slice(removeMessages)
            );

          myComments.push(replyObject.id);
          updateMyComments(myComments);

          repliedTo.push(item.id);
          updateRepliedTo(repliedTo);

          done = true;
        } catch(error) {
          console.log(`[${item.id}] Error generating reply: ${error}`);
          console.log(error.stack)
          console.log(`[${item.id}] Trying again with less context. ${removeMessages}`);
          removeMessages++;
          if(removeMessages > userMessages.length) {
            done = true;
            if(replyingToMe) {
              item.reply(`I'm sorry but I cannot generate a response to your question. Something went wrong.\n\n${generateFooter(weapons)}`);
            }
            item.save();
          }
        }
      }
    } catch (error) {
      console.error(`[${item.id}] Error replying to post: ${error}`);
      console.error(error);
    }
  }

  try {
    const comments = new CommentStream(reddit, {
      subreddit: subredditName,
      limit: 50,
      pollTime: 30000,
    });
    
    const submissions = new SubmissionStream(reddit, {
      subreddit: subredditName,
      limit: 50,
      pollTime: 30000,
    });

    comments.on('item', processItem);
    submissions.on('item', processItem);
  } catch (error) {
    console.error(`Error setting up stream: ${error}`);
  }
}

function getKeywordsFromCommentChain(commentChain, allKeywords) {
  return commentChain
    .filter(c => c.author.name.toLowerCase() !== REDDIT_USER.toLowerCase())
    .flatMap(c => {
      var content = ""
      if(c.hasOwnProperty("title"))
        content = "#" + c.title.toLowerCase() + "\n"
      
      if(c.hasOwnProperty("selftext"))
        content = content + c.selftext.toLowerCase()
      else if(c.hasOwnProperty("body"))
        content = content + c.body.toLowerCase()
      
      content += DEBUG_STRING

      return findAllKeywords(content, allKeywords)
    });
}

function getClassesFromCommentChain(commentChain) {
  return commentChain
    .filter(c => c.author.name.toLowerCase() !== REDDIT_USER.toLowerCase())
    .flatMap(c => findAllKeywords(c.body.toLowerCase(), classKeywords));
}

function getSubclassesFromCommentChain(commentChain) {
  return commentChain
    .filter(c => c.author.name.toLowerCase() !== REDDIT_USER.toLowerCase())
    .flatMap(c => findAllKeywords(c.body.toLowerCase(), subclassKeywords));
}

function generateUserMessages(commentChain, weaponAliases, weaponsMap) {
  return commentChain.map((item) => {
    const messageRole = item.author.name.toLowerCase() === REDDIT_USER.toLowerCase() ? "assistant" : "user";
    var content = ""
    if(item.hasOwnProperty("title"))
      content = "#" + item.title.toLowerCase() + "\n\n"

    if(item.hasOwnProperty("selftext"))
      content = content + item.selftext.toLowerCase()
    else if(item.hasOwnProperty("body"))
      content = content + item.body.toLowerCase()

    let messageContent = replaceAliasesWithWeaponNames(weaponAliases, content, weaponsMap);
    messageContent += DEBUG_STRING

    // Remove the footer from the message if assistant, otherwise prefix the username
    if(messageRole === "assistant")
      if(messageContent.includes("___"))
        // current messages 
        messageContent = messageContent.split("___")[0]
      else
        // legacy messages
        messageContent = messageContent.split("\n").slice(0, -4).join('\n');
    else 
      messageContent = item.author.name + ": " + messageContent

    return { role: messageRole, content: messageContent.trim() }
  });
}


async function comparisonRequested(message) {
  const ms = [
      { role: "system", content: classifierPrompt},
      { role: "user", content: message}
    ];

  const openaiResponse = await openai.createChatCompletion({
    model: "gpt-4",
    messages: ms,
    max_tokens: 1
  });

  const compare = openaiResponse.data.choices[0].message.content.toLowerCase() === "y";

  return compare;
}

async function generateAndSendReply(item, detectedKeywords, weapons, userMessages) {
  console.log(`[${item.id}] Replying to post`);
  console.log(`[${item.id}] Keywords detected: ${detectedKeywords}`);
  console.log(`[${item.id}] Weapons: ${weapons.map(w => w.name).toString()}`);

  const ms = 
    [{ role: "system", content: systemPrompt + generateCsv(weapons)}]
      .concat(userMessages);

  const openaiResponse = await openai.createChatCompletion({
    model: "gpt-4",
    messages: ms,
  });

  const aiAnswer = openaiResponse.data.choices[0].message.content
  console.log(aiAnswer);

  const reply = generateReply(aiAnswer.replaceAll("\"", ""), weapons);

  console.log(ms);
  console.log("\n");
  console.log(reply);

  item.save();
  return await item.reply(reply);
}

initialize();
