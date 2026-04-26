# Graph Report - Foliage_Care  (2026-04-26)

## Corpus Check
- 37 files · ~334,499 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 199 nodes · 255 edges · 11 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `predict()` - 9 edges
2. `build_indian_context()` - 7 edges
3. `renderAll()` - 7 edges
4. `bindProfileAuth()` - 7 edges
5. `sendFollowUp()` - 7 edges
6. `get_indian_season()` - 6 edges
7. `get_user_type_profile()` - 6 edges
8. `setInstanceData()` - 6 edges
9. `simulate_progression()` - 5 edges
10. `get_expert_plan()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `process_image()` --calls--> `predict()`  [INFERRED]
  Backend\hf_space_app.py → backup\main.py
- `Module 1 — Full plant disease diagnosis via Gemini Vision.      Returns struct` --rationale_for--> `predict()`  [EXTRACTED]
  Backend\main.py → backup\main.py
- `Module 2 — Simulates disease appearance after 7 days untreated.      Step 1: G` --rationale_for--> `simulate_progression()`  [EXTRACTED]
  Backend\main.py → backup\main.py
- `display_gradcam()` --calls--> `show()`  [INFERRED]
  Backend\utils\gradcam.py → Frontend\js\toast.js
- `home()` --calls--> `get_indian_season()`  [EXTRACTED]
  backup\main.py → Backend\main.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (35): activateTab(), bindHistoryFilters(), bindProfileAuth(), computeSummary(), createAvatarDataUrl(), escapeHtml(), exportScans(), fetchLegacyPredictionScans() (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (15): addThreadEntry(), addTypingIndicator(), animateGauge(), createSymptomSheet(), fetchPlanForPersona(), formatMarkdown(), getTimeString(), getUserName() (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (26): BaseModel, apply_turbo_colormap(), build_indian_context(), followup(), FollowUpRequest, generate_gradcam_heatmap(), get_expert_plan(), get_indian_season() (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (17): animateNumber(), bootInstance(), bootProfileMap(), computeInstanceStats(), formatDisease(), getSeverity(), invalidateProfileMap(), isInIndia() (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (7): apply_jet_colormap(), _build_jet_lut(), generate_gradcam_heatmap(), process_image(), Convert a 0-1 float heatmap to an RGB image using the Jet colormap., Generates a Grad-CAM heatmap for the given class index.     The grad_cam_model, Pre-compute a 256×3 Jet colormap lookup table (pure NumPy).

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (2): getHealthColor(), renderHealthChart()

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (2): display_gradcam(), show()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (3): getPostLoginRedirect(), redirectAfterLogin(), waitForFirebase()

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (5): attachAuthListener(), bindFullMapRedirect(), initNavbar(), showResolvedNav(), updateAuthUi()

### Community 9 - "Community 9"
Cohesion: 0.5
Nodes (4): generate_and_save_gradcam(), get_gradcam_heatmap(), Core logic to generate the heatmap array (Internal function), Main handler to call from your Backend.     Saves the image to disk and returns

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (1): createFlower()

## Knowledge Gaps
- **16 isolated node(s):** `Pre-compute a 256×3 Jet colormap lookup table (pure NumPy).`, `Convert a 0-1 float heatmap to an RGB image using the Jet colormap.`, `Generates a Grad-CAM heatmap for the given class index.     The grad_cam_model`, `Returns the current Indian season with farming-relevant context.`, `Shared Indian context block injected into every Gemini prompt.     Handles seas` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 5`** (8 nodes): `playbook.js`, `getHealthClass()`, `getHealthColor()`, `initFilters()`, `renderCare()`, `renderHealthChart()`, `renderPlantGrid()`, `renderTimeline()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (7 nodes): `gradcam.py`, `toast.js`, `build_model_for_inference()`, `display_gradcam()`, `get_gradcam_heatmap()`, `dismiss()`, `show()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (3 nodes): `cursor.js`, `createFlower()`, `cursor.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `predict()` connect `Community 2` to `Community 4`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `process_image()` connect `Community 4` to `Community 2`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `Pre-compute a 256×3 Jet colormap lookup table (pure NumPy).`, `Convert a 0-1 float heatmap to an RGB image using the Jet colormap.`, `Generates a Grad-CAM heatmap for the given class index.     The grad_cam_model` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._