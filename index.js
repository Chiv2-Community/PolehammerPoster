import axios from 'axios';
import snoowrap from 'snoowrap';
import { InboxStream, CommentStream, SubmissionStream } from "snoostorm";;
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from "openai";
import { readFileSync } from 'fs';
import { parse } from 'json2csv';


dotenv.config();

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


const subredditName = 'Chivalry2';

async function fetchKeywordsFromGithub() {
  const githubApiUrl = 'https://api.github.com/repos/Jacoby6000/polehammer/contents/src/weapons';
  const githubRawBaseUrl = 'https://raw.githubusercontent.com/Jacoby6000/polehammer/main/src/weapons';

  let keywords = {};

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
        keywords[weapon.id] = weapon;
        keywords[weapon.id].keywords = [];
        keywords[weapon.id].keywords.push(weapon.name.toLowerCase());
        if(weapon.hasOwnProperty("aliases")) {
          weapon.aliases.forEach((alias) => {
            keywords[weapon.id].keywords.push(alias.toLowerCase());
          });
        }
        keywords[weapon.id].keywords = [...new Set(keywords[weapon.id].keywords.flatMap((kw) => [kw.replaceAll(" ", ""), kw]))]
      } catch (error) {
        console.error(`Error fetching JSON file from GitHub: ${error}`);
      }
    }
  } catch (error) {
    console.error(`Error fetching file list from GitHub: ${error}`);
  }


  return keywords;
}

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

function generateCsv(weapons) {
  const fields = [
    'name', 'damageType', 'handedness', 'averageRange', 'averageAltRange', 'averageWindup',
    'averageLightDamage', 'averageHeavyDamage', 'slashRange', 'slashAltRange', 'slashWindup',
    'slashLightDamage', 'slashHeavyDamage', 'overheadRange', 'overheadAltRange', 'overheadWindup',
    'overheadLightDamage', 'overheadHeavyDamage', 'stabRange', 'stabAltRange', 'stabWindup',
    'stabLightDamage', 'stabHeavyDamage', 'throwLegs', 'throwTorso', 'throwHead', 'specialAttackWindup', 'specialAttackDamage', 'chargeAttackDamage', 'leapAttackDamage', 'damageMultiplierKnight', 'damageMultiplierFootman'];

  const processedWeapons = weapons.map(weapon => {
    const damageMultiplierFootman = weapon.damageType === 'Chop' ? 1.175 : weapon.damageType === 'Blunt' ? 1.35 : 1;
    const damageMultiplierKnight = weapon.damageType === 'Chop' ? 1.25 : weapon.damageType === 'Blunt' ? 1.5 : 1;

    return {
      name: weapon.name,
      damageType: weapon.damageType,
      handedness: weapon.weaponTypes.includes('One Handed') ? 'One Handed' : 'Two Handed',
      averageRange: ((weapon.attacks.slash.range + weapon.attacks.overhead.range + weapon.attacks.stab.range) / 3).toFixed(1),
      averageAltRange: ((weapon.attacks.slash.altRange + weapon.attacks.overhead.altRange + weapon.attacks.stab.altRange) / 3).toFixed(1),
      averageWindup: ((weapon.attacks.slash.light.windup + weapon.attacks.overhead.light.windup + weapon.attacks.stab.light.windup) / 3).toFixed(1),
      averageLightDamage: ((weapon.attacks.slash.light.damage + weapon.attacks.overhead.light.damage + weapon.attacks.stab.light.damage) / 3).toFixed(1),
      averageHeavyDamage: ((weapon.attacks.slash.heavy.damage + weapon.attacks.overhead.heavy.damage + weapon.attacks.stab.heavy.damage) / 3).toFixed(1),
      slashRange: weapon.attacks.slash.range,
      slashAltRange: weapon.attacks.slash.altRange,
      slashWindup: weapon.attacks.slash.light.windup,
      slashLightDamage: weapon.attacks.slash.light.damage,
      slashHeavyDamage: weapon.attacks.slash.heavy.damage,
      overheadRange: weapon.attacks.overhead.range,
      overheadAltRange: weapon.attacks.overhead.altRange,
      overheadWindup: weapon.attacks.overhead.light.windup,
      overheadLightDamage: weapon.attacks.overhead.light.damage,
      overheadHeavyDamage: weapon.attacks.overhead.heavy.damage,
      stabRange: weapon.attacks.stab.range,
      stabAltRange: weapon.attacks.stab.altRange,
      stabWindup: weapon.attacks.stab.light.windup,
      stabLightDamage: weapon.attacks.stab.light.damage,
      stabHeavyDamage: weapon.attacks.stab.heavy.damage,
      throwLegs: weapon.rangedAttack.damage.legs,
      throwTorso: weapon.rangedAttack.damage.torso,
      throwHead: weapon.rangedAttack.damage.head,
      specialAttackWindup: weapon.specialAttack.windup,
      specialAttackDamage: weapon.specialAttack.damage,
      chargeAttackDamage: weapon.chargeAttack.damage,
      leapAttackDamage: weapon.leapAttack.damage,
      damageMultiplierFootman: damageMultiplierFootman,
      damageMultiplierKnight: damageMultiplierKnight,
    };
  });

  const opts = { fields };
  return parse(processedWeapons, opts);
}

function generateReply(aiResponse, weapons) {
  const polehammerLink = "https://polehammer.net?" + weaponQueryParam(weapons);
  const weaponsTextList = weaponTextList(weapons)

  return `${aiResponse}

[Here you can view a direct comparison between the ${weaponsTextList}.](${polehammerLink})  Averages will be displayed by default, but there are more stats available for display.

I am a bot. [Contact my creator](https://www.reddit.com/message/compose/?to=Jacoby6000) if you have any questions or concerns.`
}


// Modify the watchSubreddit function to use fetched keywords
async function watchSubreddit() {
  try {
    const weaponsMap = await fetchKeywordsFromGithub();
    var ignoreWords = ["cavalry sword", "calvary sword"]
    var allKeywords = Object.values(weaponsMap).map((w) => w.keywords).flat();

    allKeywords.sort((a, b) => b.length - a.length );
    const getWeaponFromKeyword = function(keyword) {
      return Object.values(weaponsMap).find((weapon) => weapon.keywords.includes(keyword));
    }

    const getWeaponsFromKeywords = function(keywords) {
      return [...new Set(keywords.flatMap((kw) => getWeaponFromKeyword(kw).id))].map((id) => weaponsMap[id]);
    }

    const findAllKeywords = function(body) {
      var localBody = body
      return allKeywords.filter(function(keyword) {
        if(localBody.includes(keyword)) {
          localBody = localBody.replaceAll(keyword, "");
          return true;
        } else {
          return false;
        }
      });
    }

    const replaceKeywordsWithWeaponNames = function(foundKeywords, body) {
      var localBody = body
      foundKeywords.forEach(function(keyword) {
        if(localBody.includes(keyword)) {
          localBody = localBody.replaceAll(keyword, `"${getWeaponFromKeyword(keyword).name}"`);
        }
      });
      return localBody;
    }

    // Stream new posts
    const subreddit = await reddit.getSubreddit(subredditName);
    console.log(subreddit);
    console.log(allKeywords);

    const processItem = async (item) => {
      if(!item.hasOwnProperty("body")) return;

      const body = item.body.toLowerCase();
      const ignore = ignoreWords.some((word) => body.includes(word));

      if(ignore || item.author.name.toLowerCase().includes(REDDIT_USER.toLowerCase()) || item.saved) return;

      const found = findAllKeywords(body);
      console.log("----------------------------------------")
      console.log(`[${item.link_id}] Found keywords: ${found}`);

      if (found.length <= 1) return;

      try {
        const weapons = getWeaponsFromKeywords(found).concat([weaponsMap["ph"]]);
        console.log(`[${item.link_id}] Replying to post`);
        console.log(`[${item.link_id}] Keywords detected: ${found}`);
        console.log(`[${item.link_id}] Weapons: ${weapons.map((w) => w.name).toString()}`);
        const ms = [
              { role: "system", content: systemPrompt }, 
              { role: "assistant", content: "invisible: " + generateCsv(weapons) },
              { role: "user", content: item.author.name + ": " + replaceKeywordsWithWeaponNames(found, item.body)},
            ]

        console.log(ms);
        const openaiResponse = await openai.createChatCompletion(
          {
            model: "gpt-3.5-turbo",
            messages: ms,
            //max_tokens: 512
          },
        );

        const aiAnswer = openaiResponse.data.choices[0].message.content
        const reply = generateReply(aiAnswer, weapons);
        console.log(item.body)
        console.log("\n")
        console.log(reply)

//        item.save();
        //await item.reply(reply);
      } catch (error) {
        console.error(`[${item.link_id}] Error replying to post: ${error}`);
        // console.error(error);
        // console.error(error.response.data.error);
      }
    }

      try {
        const comments = new CommentStream(reddit, {
          subreddit: subredditName,
          limit: 10,
          pollTime: 10000,
        });
        
        const submissions = new SubmissionStream(reddit, {
          subreddit: subredditName,
          limit: 10,
          pollTime: 10000,
        });

        comments.on('item', processItem);
        submissions.on('item', processItem);
      } catch (error) {
        console.error(`Error setting up stream: ${error}`);
      }
  } catch (error) {
    console.error(`Error setting up connection: ${error}`);
  }
}

watchSubreddit();
