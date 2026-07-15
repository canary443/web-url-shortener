# lynka image prompts

Final generation specifications for the static artwork in `public/banners/`. Generate
with `gpt-image-2` through `tools/willow-mcp/server.py`, keep PNG masters
outside git, inspect them, then export the selected images as WebP.

## hero object

- output: transparent PNG, 4K
- site target: `public/banners/hero.webp`

```text
Create a polished abstract 3D hero object for lynka, a minimal URL shortener. The
composition is one floating sculptural object built from several interlocking rounded
ribbons and precise circular link forms, viewed at a gentle three-quarter angle. It
must read clearly as one intentional object, with generous empty transparent space
around it and no rectangular background. Use a restrained material palette: white
ceramic, pale cyan #ddfbff, vivid cyan #35c6f4, deep cyan #076e99, and small areas of
near-black #0a0b0d. Lighting is clean studio light with crisp soft-edged reflections,
subtle contact-like ambient shadow inside the object only, high detail, smooth premium
surfaces, and an institutional technology aesthetic. The shape should suggest links,
routing, and connected paths without using a literal chain icon. Isolated on a fully
transparent background. No text, no letters, no numbers, no logos, no watermark, no
people, no hands, no browser window, no interface screenshot, no extra floating debris,
no gradient background, no purple, no green, no orange.
```

## links feature artwork

- output: PNG, 2K
- site target: `public/banners/links.webp`

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
