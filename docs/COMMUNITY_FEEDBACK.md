# Community feedback review — Scorched Earth

Reviewed 26 October 2026. This is a qualitative sample of public discussions, not a representative player survey. Original-game memories are separated from feedback on successors. Relative dates differ between cached pages, so exact dates are stated only when visible.

## Method and limitations

The owner requested Argon research. Argon disclosed that its Session Bus toolset had no live web access. Codex therefore retrieved the primary discussions and supplied verified excerpts/paraphrases to Argon for the feature comparison and implementation. Argon's initial memory-based URLs and claims of broad consensus were excluded. Inaccessible VOGONS/MyAbandonware pages, unverified Hacker News IDs, ARK discussions, and search-result snippets without supporting context were not used to justify changes.

## Evidence and comparison

| Discussion | Observed feedback | Charred Ground comparison |
|---|---|---|
| [Windage browser remake — r/WebGames](https://www.reddit.com/r/WebGames/comments/1uejcgj/windage_a_free_browser_remake_of_scorched_earth/) | Three commenters (rohlinxeg, Beanholio, guyDea) discuss wind readability. Two criticize large/frequent changes and slow rounds; one prefers its campaign. This concerns a remake, not a demonstrated defect in original Scorched Earth. | Wind is displayed but its strength/cadence is fixed. Add configurable wind and clearer feedback. Do not import another game's damage numbers: our unlimited shell already has a different damage model. |
| [Faithful remake discussion — r/dosgaming](https://www.reddit.com/r/dosgaming/comments/h93aqh/do_you_recall_scorched_earth_fondly_are_you/) | ChristopherHale asks for a shop/economy; davispuh recalls buying nukes and the sounds; guynietoren values the financial aspect missing from Worms. The remake author dislikes some departures from the original, including 3D. | Shop, currency, interest, variable pricing, nukes, and sound are present. Preserve the owner's requested optional 3D camera; one developer's preference does not override it. |
| [Scorched Legacy discussion — r/dosgaming](https://www.reddit.com/r/dosgaming/comments/1qnfsjc/i_made_a_roguelike_inspired_by_scorched_earth50/) | Jorpho remembers rollers positively; azoriasu praises movement/fuel and teams in the original. Campaign/roguelike enthusiasm concerns a proposed successor. | Rollers, fuel and timed driving are present. Formal teams and a campaign are missing and require separate rules/validation work. |
| [Online-play question — r/retrogaming](https://www.reddit.com/r/retrogaming/comments/wibxsu/is_there_any_way_to_play_scorched_earth/) | The post explicitly asks how to play Scorched Earth online. DarthObvious84, KimKong_skRap and calthaer also recall editing firing/death quotes. | Private/public online play and local hotseat already exist. Custom quote pools are missing and selected for this update. Online features have not been exhaustively tested across networks. |
| [Shareware DOS retrospective — Hacker News, 3 September 2022](https://news.ycombinator.com/item?id=32651109) | petercooper highlights extensive customization; nicolas_t wants easier access without manually configuring DOSBox. | Browser play addresses installation friction. Match settings exist but wind configurability is a clear gap. |
| [Scorched Earth 2000 discussion — Hacker News](https://news.ycombinator.com/item?id=48129694) | Comments mix original-game memories with successor feedback. One recalls CPU-sensitive turret rotation making aiming difficult on newer machines; others enjoy large explosions. | Our simulation uses fixed steps and explosions already exist. Keyboard precision is a useful design direction, but not proof that our controls have the original timing bug. |

## Decisions

- Implement optional wind strength and cadence controls while preserving existing defaults and host authority.
- Improve wind/previous-shot information without revealing a predicted trajectory. A numeric previous-shot reference is our design inference from the wind-learning complaint, not a claimed verbatim community request.
- Add optional, bounded custom firing/death quote pools, displayed as plain text. This follows several original-player recollections in the online-play thread.
- Preserve existing weapons/economy and the owner's 3D, action-economy and no-aim-arc decisions.
- The owner selected teams/co-op first, then campaign challenges. Evidence is limited; neither is described as unanimous demand. Localized terrain destruction and a hidden classic-theme Easter egg follow them; see [the ordered roadmap](ROADMAP.md).
- Do not add guidance weapons, arbitrary damage buffs, simultaneous fire, or economy changes based on unverified claims.

## Verification boundary

This document records research evidence and decisions. Implementation status and automated/manual test results are recorded in the associated PR; a suggestion in this document does not itself establish that a feature shipped.
