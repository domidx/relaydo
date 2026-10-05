# Relaydo

**Tiny two-player games you can play with a friend by just sharing a link.**

🎮 **Play it here: https://domidx.github.io/relaydo/**

No accounts, no backend, no installs. Relaydo is a static website (plain HTML, CSS and JavaScript) hosted on GitHub Pages. The players talk to each other through public [Nostr](https://nostr.com) relays.

> This is just a fun hobby project, built for the joy of it. It's not a product, it's not cheat-proof, and it comes with no guarantees. Have fun and be nice. 🙂

> **AI-written code:** all of the code in this repository was written by **Claude Sonnet 5.5** (an AI model by [Anthropic](https://www.anthropic.com)), working from my ideas and requirements. See [Credits](#credits).

## Games

| Game | Players |
|------|---------|
| Battleship | 2 (place ships by hand or with **Random**) |
| Connect 4 | 2 |
| Tic-tac-toe | 2 |

More simple games may follow.

## How to play

1. Open the hub and pick a game.
2. One player clicks **Host a game**. An invite link is generated.
3. Send that link to your opponent (WhatsApp, email, anything).
4. The opponent opens the link (or pastes it into the **Join** box on the game page).
5. When the host sees "Opponent connected", they click **Start game**.

Every game page has **⌂ Relaydo** (home), a light/dark theme toggle (dark is the default), **Rules** and **Leave**. The layout works on phones too.

## How it works

- Players exchange small messages as **ephemeral Nostr events** (kind `24242`, inside the 20000–29999 range that relays forward but don't store).
- The invite link looks like `https://<user>.github.io/relaydo/connect4/#r=<room>&k=<key>`. The room ID and a random secret key live in the URL **fragment** (after `#`), which browsers never send to any server.
- Every message is encrypted with **AES-GCM** using that key, so relay operators only see opaque data.
- Each browser session signs its events with a **throwaway random Nostr keypair**. Nothing is persisted and nothing identifies you.
- Messages are sent to several public relays at once, and duplicates are dropped on arrival. One working relay is enough.

Default relays (editable in `js/net.js`): `relay.damus.io`, `nos.lol`, `relay.primal.net`, `offchain.pub`.

## Project structure

```
relaydo/
├── index.html          hub homepage
├── css/style.css       common styles, light/dark themes
├── js/
│   ├── theme.js        theme toggle and Home button
│   ├── net.js          Nostr networking (shared by all games)
│   └── shell.js        toolbar, host/join lobby, handshake (shared)
├── battleship/         one folder per game
│   ├── index.html
│   ├── battleship.js
│   └── battleship.css
├── connect4/
│   ├── index.html
│   ├── connect4.js
│   └── connect4.css
└── tictactoe/
    ├── index.html
    ├── tictactoe.js
    └── tictactoe.css
```

## Run locally

Browsers block ES modules from `file://`, so use any static server:

```sh
python -m http.server 8000
# then open http://localhost:8000/
```

To test with two players, open the invite link in a second browser (or a private window).

## Deploy on GitHub Pages

1. Create a repository named `relaydo` and push these files to `main`.
2. Go to **Settings → Pages** and choose **Deploy from a branch**: `main`, folder `/ (root)`.
3. The site goes live at `https://<username>.github.io/relaydo/` (for this repo: https://domidx.github.io/relaydo/).

## Adding a game

1. Copy an existing game folder (e.g. `tictactoe/`) to `<yourgame>/` and rename the files.
2. Write the game logic using the shared shell, which handles the lobby, handshake and toolbar:

   ```js
   import {initGame} from '../js/shell.js';

   const shell = initGame({
     name: 'My Game',
     rules: '<p>Explain the rules in HTML.</p>',
     onStart: ({role, send}) => { /* role is 'host' or 'guest'; send(type, data) messages the opponent */ },
     onMessage: (type, data) => { /* handle messages from the opponent */ },
   });
   shell.addButton('Rematch', () => { /* extra toolbar buttons */ });
   ```
3. Add a card for it in the root `index.html` (cards are kept in alphabetical order).

## Known limitations

- **Public relays can be flaky or rate-limited.** The lobby shows how many relays are connected.
- **Closing a tab isn't detected.** Pressing **Leave** (or Home) notifies the opponent, but a silently closed tab or dropped connection doesn't. A heartbeat for this exists in `js/shell.js` and is commented out.
- **No reconnecting or saved games.** If a player reloads mid-game, the game is over.
- **Battleship is trust-based.** Each player's browser holds their own fleet and answers the opponent's shots honestly; a tampered client could lie.
- **Anyone with the link can join** until the room has two players. Share it only with your opponent.
- **Clients trust each other.** There is no server to enforce the rules, so a determined cheater could tamper with their own browser. It's meant for friends.
- The signing library ([`@noble/curves`](https://github.com/paulmillr/noble-curves)) is loaded from the [esm.sh](https://esm.sh) CDN, so an internet connection is required.

## Credits

- **Code, structure and this README:** written by Claude Sonnet 5.5 (Anthropic), via the claude.ai chat interface, in October 2026.
- **Concept, design decisions, requirements, review and testing:** the repository owner, who steered the project through conversation with Claude.

The code has been reviewed and tested only lightly, so expect rough edges.

## License

Do what you like with it. Add a license file (e.g. MIT) if you want to make that official.
