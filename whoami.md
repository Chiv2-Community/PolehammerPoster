# Who is the polehammer poster?
PolehammerPoster posts unofficial Chivalry 2 weapon stats when it is triggered. The weapon data is fed to GPT-4 as a 
CSV, as well as up-to 5 messages from the comment chain being addressed.

# How do I talk to polehammer poster?
1. Mention 2 weapons by name or one of their aliases as defined in the [polehammer.net weapon data](https://github.com/aardvarkk/polehammer/tree/main/src/weapons).
2. Reply to a comment made by PolehammerPoster
2. Mention PolehammerPoster by name
   * /u/PolehammerPoster
   * Polehammer poster
   * PolehammerPoster

# What kinds of questions can PolehammerPoster answer?
PolehammerPoster can answer any question about data defined in the [polehammer.net weapon data](https://github.com/aardvarkk/polehammer/tree/main/src/weapons).  You can ask by weapon type (blunt, cut, chop, one handed, two handed, axe, sword, polearm, one handed, two handed, etc), or using weapon names. 

Examples:
* PolehammerPoster, what is your favorite blunt weapon?
* I wonder if the Executioner's Axe or the Highland Sword does more damage.
* Does the knife have more range than the mallet?

# What kinds of questions can PolehammerPoster not answer?
PolehammerPoster is not aware of the combat mechanics in the game.  The language model's training set gets cut off in March 2021, and as such does not know much about chivalry 2.  It sometimes has some insight in to how game mechanics work, but this is purely happenstance and likely carryover from chivalry 1 knowledge.  In the future we may teach it the combat mechanics so people can ask for help with general combat.

# PolehammerPoster posted an incorrect stat.
There are a couple of reasons an incorrect stat may be posted.
1. The stat is wrong on [polehammer.net](https://polehammer.net). Please submit
   an issue/correction to either to the 
   [github repo](https://github.com/aardvarkk/polehammer), 
   [PolehammerSupremacy](https://www.reddit.com/message/compose/?to=PolehammerSupremacy) or to 
   [me](https://www.reddit.com/message/compose/?to=Jacoby6000)
2. The AI made it up.  The bot really wants to be helpful. So much that 
   sometimes it makes up stats.  We can control this to some degree using the 
   system prompt.  If this occurs, please 
   [submit an issue](https://github.com/Chiv2-Community/PolehammerPoster/issues), 
   [contact PolehammerSupremacy](https://www.reddit.com/message/compose/?to=PolehammerSupremacy),
   or [contact me](https://www.reddit.com/message/compose/?to=Jacoby6000)
3. GPT-4 is very good, but its still very new tech and the AI is still 
   improving. If the stat is correct on 
   [polehammer.net](https://polehammer.net), but wrong in polehammerposter's 
   comment, then this was likely an error in the language model, GPT-4. As the 
   language models improve, these types of errors will become less frequent.
