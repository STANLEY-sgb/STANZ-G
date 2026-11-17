# STANZ G — How to Play

**Survive. Fight. Dominate.**

STANZ G is a tactical survival shooter — think squad battles, a Battle Royale
drop onto a full island, and real online multiplayer against your friends,
all running on your phone with no app-store install needed to try it (the
APK is a separate, optional step if you want it as a proper home-screen app).

---

## 1. Installing the game on your phone

You'll get a file called **`app-debug.apk`**. This is a normal, installable
Android app — it's just not on the Play Store (yet), so Android will ask you
to confirm you trust it. That's expected and normal for an app shared
directly like this.

1. Get the file onto your phone (WhatsApp, email, a cloud drive link,
   Bluetooth — whatever's easiest).
2. Tap the file to open it.
3. Android will likely say **"For your security, your phone is not allowed
   to install unknown apps from this source."** Tap **Settings** on that
   prompt, turn on **"Allow from this source"**, then go back and tap the
   file again.
4. Tap **Install**. When it finishes, tap **Open** — or find **STANZ G** on
   your home screen / app drawer, it'll have an orange "G" badge icon.

That's it — no account, no sign-up, no download inside the app.

> **Important — read this before you tap anything in the menu:**
> Three of the four modes need absolutely nothing else from you. Tap
> **TRAINING GROUND**, **TEAM DEATHMATCH**, or **BATTLE ROYALE** and you are
> playing within a second or two — no address, no name, no server, nothing
> to set up. They're all marked **NO SETUP** on their button.
>
> Only **ONLINE MULTIPLAYER** (marked **NEEDS A HOST**) asks for anything,
> because that's the one mode where you're playing against real people
> instead of AI — see section 4 below. If you weren't trying to play with
> friends right now, you tapped the wrong button: go back and pick one of
> the other three.

---

## 2. Controls

STANZ G is built for touch. When you start a match you'll see:

| Where | What it does |
|---|---|
| **Left half of the screen** | Drag to move (it's a virtual joystick — appears wherever you first touch) |
| **Right half of the screen** | Drag to look around / aim the camera |
| **FIRE** (big button, bottom-right) | Hold to shoot. Full-auto weapons keep firing while held |
| **AIM** | Toggle aim-down-sights (steadier aim, zoomed view on some weapons) |
| **RELOAD** | Reload your current weapon |
| **JUMP** | Jump (also used to drop from the plane in Battle Royale!) |
| **RUN** | Toggle sprint |
| **CROUCH / PRONE** | Lower your stance — better accuracy and harder to spot |
| **TAKE** | Pick up a weapon/ammo/medkit you're standing near, or get in/out of a vehicle |
| **❚❚ MENU** (top-right) | Pause |

If you're playing on a PC/laptop instead: **WASD** to move, **mouse** to
look, **left-click** to fire, **right-click** to aim, **R** to reload, **E**
to pick up or drive, **Shift** to sprint, **Space** to jump, **C**/**X** to
crouch/prone, **Esc** to pause. All of this is also listed in-game under
**Controls** on the main menu.

---

## 3. The game modes

From the main menu, pick a mode and tap it to play immediately:

### 🎯 Training Ground
Solo vs AI. Start with just a pistol and clear out three hostile outposts
scattered across the island (The Warehouse, Pine Village, Overwatch Ridge).
Loot better weapons, ammo, and medkits as you go. Good place to learn the
map and the guns before jumping into a real match.

### ⚔️ Team Deathmatch
4-on-4 at Base Alpha: you and three AI squadmates (STANZ) vs four AI
hostiles (RAVEN). First team to 25 kills wins, or whoever's ahead when the
8-minute clock runs out. You respawn a few seconds after dying — keep
fighting. Your squadmates' health shows up top-left during the match.

### 🪂 Battle Royale
You and 23 other operators drop from a plane onto the full island. No
weapons at first — you steer your fall, pop a parachute automatically near
the ground, and land to loot. A storm wall slowly closes in over the match;
staying outside it hurts, so keep moving toward the safe zone shown on your
minimap (white circle = current safe zone, orange = where it's shrinking
to next). Supply crates occasionally parachute in with better gear. Jeeps
and a boat are scattered around for fast travel. Last one standing wins.

### 🌐 Online Multiplayer
Real players, not AI — see the next section for how to set this up with
your friends.

---

## 4. Playing Online Multiplayer with friends

This mode needs one person to **host** a small server — it's a program that
runs on a laptop or PC and lets everyone's phones talk to each other over
the same Wi-Fi network. It only takes one person to do this, and it's free.

**If you're hosting (Windows, easiest way):**
1. In the STANZ G project folder, open the `server` folder and
   double-click **`start-server.bat`**. That's it — no typing. The first
   time, it'll quietly install what it needs (needs Node.js already
   installed on that PC); every time after that it starts instantly.
2. A black window opens and prints an address for every player, already
   worked out for you, like:
   ```
   Give THIS to everyone else on your Wi-Fi:
      192.168.1.23:8080
   They type it into ONLINE MULTIPLAYER as:
      ws://192.168.1.23:8080
   ```
3. Keep that window open for as long as you want the match to run — closing
   it ends the match for everyone.

*(Mac/Linux, or prefer a terminal: `cd server`, `npm install` the first
time only, then `node server.js` — same printed address either way.)*

**Everyone else (including the host, on their own phone):**
1. Make sure you're on the **same Wi-Fi network** as the host's computer.
2. Open STANZ G, tap **ONLINE MULTIPLAYER**.
3. Your name is optional — leave it blank if you want. For the server
   address, type exactly the `ws://...` line the host's window printed.
4. Tap **Connect**.

You'll be auto-balanced onto a team (STANZ or RAVEN) and dropped straight
into a live match — same first-to-25 rules as Team Deathmatch, except every
other soldier you see is a real friend, not AI.

**If it won't connect:** double-check everyone's on the same Wi-Fi (not one
person on mobile data), double-check the address was typed exactly as shown
(including `ws://`, not `http://` or `wss://`), and check the host's
computer firewall isn't blocking the port.

---

## 5. Settings

From the main menu, tap **Settings**:
- **Graphics quality** — Low/Medium/High/Ultra. If the game feels laggy,
  drop this down (it'll also auto-lower itself if your phone is struggling,
  but you can always set it manually).
- **Look sensitivity** — how fast the camera turns when you drag.
- **Invert vertical look** — for players who prefer it.
- **Sound** — on/off for all game audio.

Your choices (and your chosen operator) are remembered automatically next
time you open the app.

---

## 6. Quick troubleshooting

| Problem | Try this |
|---|---|
| Won't install / "app not installed" | Make sure you downloaded the whole file (re-send it if it looks small/corrupted), and double check "unknown sources" is allowed for whichever app you opened the file from. |
| Looks laggy / low frame rate | Settings → Graphics quality → Low or Medium. |
| Can't connect to Online Multiplayer | Same Wi-Fi as the host, address starts with `ws://`, host's firewall allows the port. |
| Controls feel unresponsive | Settings → raise Look sensitivity; make sure you're dragging from inside the screen half the control lives in. |
| Sound isn't playing | Settings → Sound must be on, and your phone's media volume (not just ringer) needs to be up. The first sound only plays after your first tap in the app — that's a phone/browser rule, not a bug. |

---

Have fun, and good luck out there, operator.
