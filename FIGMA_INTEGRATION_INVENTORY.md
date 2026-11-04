# NEXUS Figma integration inventory

Source: [NEXUS-IISER-TPT-1.0v](https://www.figma.com/design/OWN02NpF8sieO58zjAGikS/NEXUS-IISER-TPT-1.0v?node-id=0-1)
File key: `OWN02NpF8sieO58zjAGikS` · Design file has 9 pages; route map below includes the primary page (`LANDING HERO PAGE`, `0:1`) and additional UI pages.
Implementation: `C:\NEXUS-a new breakthrough\frontend` (React 18, Vite, React Router, TypeScript, inline CSS + `index.css`; Lucide React available).

## Frame and route inventory

| Figma frame | Node | Existing project route/page | Coverage |
|---|---|---|---|
| Landing · Desktop | `3:111011` | `/` and `/landing` · `LandingPage` | Existing page; inspect long page sections and replace unsupported visual/animation differences incrementally |
| Landing · Tablet | `3:115123` | `/` · responsive `LandingPage` | Responsive variant identified; needs viewport comparison |
| Landing · Mobile | `3:115405` | `/` · responsive `LandingPage` | Responsive variant identified; needs viewport comparison |
| Login | `3:111300` | `/auth` · `AuthPage` | Existing auth page; current route combines auth states |
| Sign Up | `3:111345` | `/auth` · `AuthPage` | Existing auth page; separate Figma frame |
| Forgot Password | `3:111399` | `/auth` · `AuthPage` | Existing auth page; separate Figma frame |
| Dashboard | `3:111436` | `/dashboard` · `DashboardPage` | Route mapped; screenshot compared, visual differences remain |
| Academic Repository | `3:111636` | `/repository` · `RepositoryPage` | Route mapped; visual comparison pending |
| My Courses | `3:111839` | `/courses` · `CoursesPage` | Route mapped; visual comparison pending |
| Friends | `3:112029` | `/friends` · `FriendsPage` | Route mapped; visual comparison pending |
| Messenger | `3:112255` | `/messaging` · `MessagingPage` | Route mapped; visual comparison pending |
| Discussion Forums | `3:112450` | `/forums` · `ForumsPage` | Route mapped; visual comparison pending |
| Study Groups | `3:112633` | `/studygroups` · `StudyGroupsPage` | Route mapped; visual comparison pending |
| Campus Pulse | `3:112835` | `/campus` · `CampusHubPage` | Route mapped through `tab=pulse`; visual comparison pending |
| Events | `3:113002` | `/campus?tab=events` · `CampusHubPage` | Route mapped through query tab; visual comparison pending |
| Lost & Found | `3:113249` | `/campus?tab=lostfound` · `CampusHubPage` | Route mapped through query tab; visual comparison pending |
| Opportunities | `3:113432` | `/campus?tab=opportunities` · `CampusHubPage` | Route mapped through query tab; visual comparison pending |
| Question of the Day | `3:113624` | `/qotd` · `QOTDPage` | Route mapped; visual comparison pending |
| Answer of the Day | `3:113781` | `/aotd` · `QOTDPage` | Route mapped; visual comparison pending |
| Productivity | `3:113931` | `/productivity` · `ProductivityPage` | Route mapped; visual comparison pending |
| Student Profile | `3:114110` | `/profile` · `ProfilePage` | Route mapped; visual comparison pending |
| Notifications | `3:114286` | `/notifications` · `NotificationsPage` | Route mapped; visual comparison pending |
| Settings | `3:114461` | `/settings` · `SettingsPage` | Route mapped; visual comparison pending |
| Foundations & UI kit | `3:114653` | Shared theme/components | Token and component reference; not a route |
| Interaction states | `3:114837` | Shared controls | Variant/state reference; not a route |
| Contextual overlays | `3:114986` | Search and upload modal components | Overlay reference; not a route |
| Dashboard · Tablet | `3:115665` | `/dashboard` · responsive `DashboardPage` | Responsive variant identified; needs viewport comparison |
| Dashboard · Mobile | `3:115836` | `/dashboard` · responsive `DashboardPage` | Responsive variant identified; needs viewport comparison |
| Messenger · Mobile | `3:115979` | `/messaging` · responsive `MessagingPage` | Responsive variant identified; needs viewport comparison |
| Academic Repository · Mobile | `3:116039` | `/repository` · responsive `RepositoryPage` | Responsive variant identified; needs viewport comparison |

Existing `/ai` and `/latex` routes have no corresponding top-level frame in this Figma page; retained as existing project features.

## Retrieved design facts

- Shared dark palette includes canvas `#0C0D10`, navigation `#101115`, surface `#15171D`, border `#2A2C36`, primary violet `#956AFF`, primary text `#F3F2F7`, muted text `#9699AA`; fonts are Manrope and Inter.
- Desktop app frame is 1440×900. Expanded navigation rail is 232px wide. The dashboard screenshot confirms a 72px top header, 24px main content inset, line icons, compact navigation labels, and dark outlined cards.
- Mobile frames are 390px wide; tablet frames are 834px wide.
- Frames for dashboard, repository, login, messenger, and forums returned high-fidelity design context and screenshot renders. Metadata for all top-level frames was retrieved. The full list of nested components and variants is represented in frame metadata; component-level contexts have not all been individually expanded.

### Additional Figma pages

The file also has eight non-landing pages. These contain the app's same 232×900 sidebar and 1208×900 workspace shell; page content begins at a 24px inset below the 72px global header.

| Figma page | Page content node | Main composition observed | Project mapping |
|---|---|---|---|
| `UI-7 SETTINGS` (`46:5638`) | `46:5744` | Settings categories and account/preferences panels | `/settings` · `SettingsPage` |
| `UI-8 ACADEMIC REPO` (`46:5859`) | `46:5965` | Academic Repository screen | `/repository` · `RepositoryPage` |
| `Page 9` (`47:6096`) | `47:6202` | Empty page | No route |
| `UI-4 QOTD` (`46:5281`) | `46:5388` | Daily question, answer form, and related content | `/qotd` · `QOTDPage` |
| `UI-5 AOTD` (`46:5282`) | `46:5568` | Featured answer article and related content | `/aotd` · `QOTDPage` |
| `UI-3 EVENT` (`46:5011`) | `46:5117` | Event filters and two-column event listings | `/campus?tab=events` · `CampusHubPage` |
| `UI-1` (`46:3964`) | `46:4666` | Dashboard grid with timetable and academic overview | `/dashboard` · `DashboardPage` |
| `UI-2 MESSGENGER PAGE` (`46:4787`) | `46:4893` | Three-pane messenger workspace | `/messaging` · `MessagingPage` |

The Figma Plugin API scan found no prototype reactions on the eight meaningful app pages or the landing page. This means the file provides screen composition and motion tracks, but no inspectable prototype trigger/transition map for navigation flows.

## Animation and interaction mapping

| Component/flow | Trigger | Figma motion data | Implementation status |
|---|---|---|---|
| Landing Nₓ breathing glow | Continuous | 8s loop; box-shadow pulse; ease-in-out | Not implemented |
| Landing color-cycle navigation accents | Continuous | 8s linear horizontal loops; node-specific travel distances (e.g. 188px, 74px, 108px, 142px) | Not implemented |
| Landing Login button | Continuous | 8s ease-in-out rotation/scale keyframes; separate traveling sheen | Not implemented |
| Landing rays and glitter | Continuous | 8s looping opacity/rotation/position tracks with staggered keyframe times | Not implemented |
| Landing hero headline | Page entry/repeating timeline | Character reveal, 39 groups, left-to-right; 150ms start; ~51.3ms stagger; 2s preset duration; linear | Character opacity reveal implemented with 51.282ms stagger, starting at 150ms |
| Landing supporting copy and actions | Page entry/repeating timeline | 8s timeline; staggered opacity + 14px blur reveal; ease-out | Timed 8s blur reveal implemented for hero copy, actions and reassurance; reduced motion supported |
| Landing product preview and sections | Continuous/page entry | Luminous background translates 2480px over 8s linearly; sequential bullet/flame/text reveals; sections reveal at staggered points | Not implemented |
| Dashboard, interaction states, contextual overlays | Hover/click/overlay as represented visually | Recursive motion queries returned no keyframe tracks for dashboard, interaction-states, or overlays. Prototype connection/transition metadata was not exposed in retrieved contexts. | Existing functional interactions retained; full Figma trigger audit is pending |

## Work completed in this pass

- Replaced emoji sidebar navigation with installed Lucide line icons and aligned the expanded rail to Figma's 232px width.
- Updated the shared header height to the 72px frame measurement and adjusted its horizontal inset.
- Changed routed application page insets from 36px to the Figma 24px content inset and removed the 1360px/1100px centering caps that compressed the workspace content.
- Added the missing Accessibility category to Settings.
- Centered the landing hero, adjusted its headline scale, and added Home, Features, Community, and About anchors.
- Removed the unsupported meteor field and added the retrieved headline character stagger and timed hero blur reveals, with reduced-motion support.
- Downloaded the Figma login campus-life photo to `frontend/public/assets/nexus-campus-life.jpg` and wired it into `AuthPage`; adjusted the authentication panels to the 650px/remaining-width desktop split and added mobile stacking. Other source assets remain to be retrieved.
## Remaining validation

- [x] Inspect page inventory and scan prototype reactions across the document's pages; no reactions were exposed by the Plugin API.
- [ ] Expand every page and UI-kit child node into its own high-fidelity context; several large context calls time out, so this remains partial.
- [ ] Compare every desktop page and each supplied responsive frame against the running site; browser loads and content trees were checked on Settings, Events, and Question of the Day, but comprehensive screenshot-by-screenshot comparison remains incomplete.
- [ ] Implement remaining landing timeline tracks (glow, navigation accents, CTA sheen, rays/glitter, and preview sequences); only headline and supporting-copy reveals are currently implemented.
- [x] Run the production frontend build after the shared geometry update; `tsc -b` and `vite build` pass. Vite reports the existing large-bundle advisory (~703 kB minified JavaScript).




