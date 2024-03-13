import snoowrap from 'snoowrap';
import { CommentStream, SubmissionStream } from "snoostorm";;
import dotenv from 'dotenv';

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


async function initialize() {
  try {
    processSubredditItems("Chivalry2", myComments, repliedTo, allKeywords, weaponAliases, weaponsMap, ignoreWords, banlist);
    processSubredditItems("ChivalryCreatorsGuild", myComments, repliedTo, allKeywords, weaponAliases, weaponsMap, ignoreWords, banlist);
  } catch (error) {
    console.error(`Error setting up connection: ${error}`);
  }
}


async function processSubredditItems(subRedditName, myComments, repliedTo, allKeywords, weaponAliases, weaponsMap, ignoreWords, banlist) {
  const subreddit = await reddit.getSubreddit(subRedditName);

  const processItem = async (item) => {
    try {
      var body = ""
      if(item.hasOwnProperty("body"))
        body = item.body.toLowerCase();
      else 
        body += `#${item.title.toLowerCase()}\n\n${item.selftext.toLowerCase() ? item.selftext.toLowerCase() : ""}`;

      if(item.author.name.toLowerCase().includes(REDDIT_USER.toLowerCase()) || item.saved) return;
      
      const summoningMe = body.includes(REDDIT_USER.toLowerCase())

      if(!summoningMe) {
        return;
      }

      const replyObject = 
        await item.reply("Sorry, but PolehammerPoster is no longer providing weapon data. The data used by the bot is accessible here: https://github.com/Chiv2-Community/chivalry2-weapons. TornBanner is not supporting their community, so I cannot continue to support it for them in good concious. There was a hope when a new CM was onboarded that things would improve. They have only continued to get worse.");

      item.save();
    } catch (error) {
      console.error(`[${item.id}] Error replying to post: ${error}`);
      console.error(error);
    }
  }

  try {
    const comments = new CommentStream(reddit, {
      subreddit: subRedditName,
      limit: 50,
      pollTime: 30000,
    });
    
    const submissions = new SubmissionStream(reddit, {
      subreddit: subRedditName,
      limit: 50,
      pollTime: 30000,
    });

    comments.on('item', processItem);
    submissions.on('item', processItem);
  } catch (error) {
    console.error(`Error setting up stream: ${error}`);
  }
}

initialize();
