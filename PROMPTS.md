# lynka image prompts

Final generation specifications for the static artwork in `public/banners/`. Generate
with `gpt-image-2` through `tools/willow-mcp/server.py`, keep PNG masters
outside git, inspect them, then export the selected images as WebP.

## hero object

- output: PNG on flat magenta, 4K, background removed afterwards by chroma key
- site target: `public/banners/hero.webp` (WebP with alpha)
- gpt-image-2 cannot produce real transparency. ask for one exact flat magenta
  background (#ff00e6) instead, then key it out: alpha ramps down as
  min(r, b) - g rises, despill the edge pixels by clamping r and b toward g

```text
Create a polished abstract 3D hero object for lynka, a minimal URL shortener. The
composition is one floating sculptural object built from several interlocking rounded
ribbons and precise circular link forms, viewed at a gentle three-quarter angle. It
must read clearly as one intentional object with generous empty space around it. Use a
restrained material palette on the object only: white ceramic, pale cyan #ddfbff, vivid
cyan #35c6f4, deep cyan #076e99, and small areas of near-black #0a0b0d. Lighting is
clean studio light with crisp soft-edged reflections, high detail, smooth premium
surfaces, an institutional technology aesthetic. The shape should suggest links,
routing and connected paths without a literal chain icon. The background must be one
exact flat uniform solid color: vivid magenta #ff00e6, completely even edge to edge, no
gradient, no vignette, and no shadow cast onto it. The object itself must contain no
magenta, no pink and no purple anywhere. No text, no letters, no numbers, no logos, no
watermark, no people, no hands, no extra floating debris.
```

## card icons (replaced the full-bleed links artwork on 2026-07-15)

- output: PNG on flat magenta, 2K each, keyed to alpha, trimmed webp ~480px wide
- site targets: `public/banners/icon-anon.webp`, `icon-stats.webp`,
  `icon-privacy.webp`, `icon-dashboard.webp` (the last one sits on the black card)
- every prompt ends with the shared tail: centered composition with very
  generous empty margins, object fills roughly half the frame, clean studio
  light, institutional aesthetic, exact flat #ff00e6 background, no magenta or
  purple in the object, no text/logos/people
- concepts:
  - icon-anon: abstract stopwatch, white ceramic ring, pale cyan face, vivid
    cyan crown and marker, small near-black accents (60 minute lifetime)
  - icon-stats: three rounded pillars of different heights on a white ceramic
    base, pale/vivid/deep cyan (click statistics)
  - icon-privacy: classic rounded heraldic shield, vivid cyan rim, white
    ring, pale cyan panel, deep cyan check mark (owner-picked over a dome and
    a closed eye)
  - icon-dashboard: chunky speedometer gauge, four wedges pale/vivid/deep
    cyan + glossy near-black, white ceramic needle with chrome pivot, from the
    owner's reference image, sits on the near-black card

## links feature artwork (retired, kept for reference)

- output: PNG, 2K
- site target: `public/banners/links.webp` (no longer used on the page)

```text
Create a wide abstract 3D feature image for lynka inside a near-black #08090c world.
Show a compact system of smooth interlocking paths, short cylindrical connectors, and
one precise luminous circular route passing through the composition from left to right.
Use black graphite materials, white ceramic highlights, restrained cyan #35c6f4, and
deep cyan #076e99 only. Place the main sculptural cluster slightly right of center so
the left side retains calm negative space. Add one tiny precise line symbol in the
upper corner, made only from thin cyan strokes and simple geometry, with no letters.
The result should feel engineered, polished, minimal, and high detail, similar to
premium infrastructure product art rather than a generic sci-fi render. Exact solid
background color #08090c so the image blends into the site media frame. No text, no
letters, no numbers, no logos, no watermark, no people, no devices, no dashboards, no
purple, no green, no orange, no bloom clouds, no bokeh, no lens flare.
```

## api feature artwork

- output: PNG, 2K
- optional future target: `public/banners/api.webp`

```text
Create a wide abstract 3D image representing a fast, controlled API connection for
lynka. On an exact solid near-black #08090c background, arrange a sparse sequence of
precision-machined ports and rounded black modules connected by one clean cyan signal
line. Use graphite black, soft white, pale cyan #ddfbff, vivid cyan #35c6f4, and deep
cyan #076e99. The modules should have subtle real depth, crisp bevels, restrained
reflections, and generous negative space. Composition should be horizontal and balanced,
with the main forms in the lower-right two thirds and one small thin-line technical
symbol in the upper-left corner. Institutional, minimal, premium, high detail, no visual
clutter. No text, no letters, no code characters, no numbers, no logos, no watermark,
no people, no screens, no keyboard, no purple, no green, no orange, no gradients, no
bokeh, no lens flare.
```

## generation notes

- run one image at a time and leave at least 60 seconds between upstream calls
- start with 1K only for composition probes; probes are disposable
- final hero uses 4K, final section art uses 2K
- reject any output containing pseudo-text, extra symbols, muddy blacks, or a visible
  background edge around the transparent hero object
