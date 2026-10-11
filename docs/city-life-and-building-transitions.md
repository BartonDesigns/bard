# City life and building transitions

## Playable changes

Office floor plans now publish workstation and paired meeting roles. Occupants type,
review documents and pause between tasks. Meetings use alternating speakers, with
occasional deadline disputes, emphatic gestures, facial anger and louder nearby vocal
ambience. Mall storefronts have checkout counters, attendants and customers who browse,
negotiate, agree a sale and carry a bag. A shared per-shop stock record counts each sale
once. Scenes stop transacting when a partner leaves or is engaged in conversation.
Two nearby world-space captions keep the dialogue legible without adding HUD controls.
Retail floors now request a retail population instead of office staff.

Conversation openings consider the actual NPC's current job, remembered meetings,
completed quests, visible injury, weapon aiming and observed incidents. Crimes take
priority over introductions or praise. Vehicle impacts now enter the crime/wanted and
witness systems; vehicle collision checks also reject people on a different floor.
Witnesses retain a bounded, time-limited memory when promoted to a saved resident.
Nearby received multiplayer gunfire and host-observed civilian attacks distinguish the
other player from the local player. Wanted status is described as patrol knowledge, not
as a falsely claimed eyewitness account. Apologizing does not erase the incident.
The highest-priority facts are sent first in the existing deployed /talk schema's
10-fact budget, so this client release does not require a new Worker deployment.

Asking an NPC for work uses the existing validated conversation quest planner, with an
offline fallback. Office and mall checks use real named floor stations. A workplace
objective must be reached on its own floor. Visits, returns and actual conversations
provide evidence; claiming success in prose does not. The game attaches a fixed reward
of 220–340 inventory credits to a new 2–4 step quest. The model cannot choose the amount.
Explicit acceptance, world identity, correct recipient, saved completion evidence and an
idempotent inventory receipt gate payment. Failed saves or locked trades leave a pending
reward. Completing a quest is remembered by its issuer and changes later openings.

The reload test also exposed and repaired an older inventory initialization defect:
transactions without `at` could leave `updatedAt` at zero, causing the starting-credit
check to replace a saved wallet. Initialization now requires an actually empty,
untouched inventory, and adapter transactions acquire a timestamp.

## Building repair

- Commercial detail now participates in the same complementary screen-door fade as its
  coarse shell. Previously it remained fully visible over a partially visible proxy.
- All detailed parts, including hinged doors, use one building anchor. A door's pivot
  cannot independently move its detail threshold.
- Larger shops use an identical footprint radius in both fades.
- Newly built detail and its proxy share a half-second readiness fade. Detail becomes
  eligible only after construction finishes.
- Near and coarse exteriors use the same source palette and sRGB conversion. Procedural
  house proxies use the detailed plan's floor and eave heights, including wings.
- Detailed shops keep the source footprint instead of shrinking their shell. Flying
  above the detail range restores coarse geometry when the detailed group is hidden.
- Existing shared house roof meshes remain the single roof representation.

## Verification and scope

Production character/activity and house/shop material fixtures are rendered at desktop
and phone viewport sizes. They exercise desk work, disagreement, negotiated sale,
stock decrement, purchase bag, near/transition/far views, and shader compilation.
The full game conversation harness uses deterministic model proposals to test actual
intent execution, quest evidence, payment, incident reactions and persistence.
Recorded output is in `verification/city-life/`.

These are bounded ambient scenes and evidence-driven inspection/scouting quests.
They are not an autonomous economy, arbitrary AI-authored combat/delivery missions,
or server-persisted shared NPC memories. Received multiplayer events can be observed
locally; cross-client reputation and every remote vehicle crime are not synchronized.
Phone tests use Chromium at phone dimensions; physical Safari remains unverified.
