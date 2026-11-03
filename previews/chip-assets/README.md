# Player chip preview assets

Design references: Figma file SEiJgNuPKiLyf8iSbtvbe6, nodes 1131:222 and 1135:255.
Original PNG/SVG assets were exported by Figma's design context. Lightweight WebP
derivatives are used only for the self-contained conversation preview. Anybody
ExtraBold, Black and Expanded Medium are the exact local font styles from the
production font collection.

The photo is a preview reference background, not broadcast overlay artwork.
The decktype image is the Figma example; the eventual template must resolve real
decktype images from the production network location through an HTTP asset path.

This is a design review mockup, with no SPX lifecycle or template definition.
Chip width is max(410, 87 + measured name width + 38) in 1080p pixels. Blue is
anchored at x=145, y=815; Red mirrors around the full 1920px canvas. The artwork
occupies the inner 196px end region and text may overlap it. The entrance ends
at 500ms, shares the existing ease-out curve, and adds a small positional settle.
Exit retracts in 220ms. Neither entrance nor exit animates opacity.
