# Charred Ground architecture

The runtime lives in `index.html`. Three.js r128 and PeerJS 1.5.4 load from CDNs. UI styles and game code are inline; audio is synthesized through one AudioContext.

- **Simulation:** fixed-step ballistics with wind and selectable boundaries. A data-driven registry routes payloads, equipment, structures and drones. The world spans 480 meters; its 481-sample heightfield is extruded into a 160-meter-wide indexed terrain mesh.
- **Rendering:** terrain vertices and normals change only on dirty frames. Particles use a 400-slot buffer; shells, trees and rocks use instancing. Trails use a bounded buffer and expire after impact. Water uses a lightweight animated shader. Removed entity meshes dispose their geometry/materials.
- **Camera:** tactical overview, tank focus, gunner optics and orbital exploration share one perspective camera. Orbit, tilt, zoom and pan are local presentation state. A 3D shot begins with a short tank-side launch camera and returns to tactical framing; projectile height expands the view. Solid trails show sampled flight history; dashed arcs estimate the remainder.
- **Multiplayer:** PeerJS host-authoritative snapshots carry terrain, combat, inventory and shop state. The host validates ownership and turn order for commands. Camera state and API keys are never broadcast. Disconnected guests become bots; host migration is not implemented. The Charred room prefix separates the enlarged-map build from the older release.
- **AI:** local numerical targeting works without a key. Optional Gemini JSON decisions are validated and time out after three seconds. Keys stay in page memory and go only to Google's API.

The Sites deployment retains its existing project identity. Hosting credentials, local deployment archives, temporary scripts and account configuration are deliberately not stored in this repository.

- **Custom maps:** versioned bounded map records hold the heightfield, six spawn locations and up to 16 destructible platform decks. Local storage contains map data only. The editor pauses simulation and keeps a full snapshot for cancel; host snapshots carry decks and the round-reset map. Platform support augments terrain height for tanks while deck-slab collision handles shots.
