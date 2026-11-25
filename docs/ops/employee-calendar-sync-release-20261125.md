# Mobile calendar accounting 1.25.27

Released 25 November 2026 (Moscow). Running source
`0a2a31b03bcb91661c31dcb4e8ed2746e5560d99`, built at
`2026-11-25T07:13:43.364Z`. Exact image
`sha256:13ba6a30d4b06f36a3f64a64fd120c402ebe5bc56008d55311509928d116b4f5`.
Session `df71f5ba050d4b1d8e31bde5786bcc2c` reached COMPLETE.
Previous verified image `sha256:b3e2bbf036d44f6ad48e2a58a10b67433cad022e7b58af79097eee82d57c8d21`
and the second reserve remain protected. Exact archive retained locally.

Retail, wholesale and procurement employees see their accounted status in
the mobile calendar and ADMIN preview. Saved plans still drive planning and
editing. The release contains no schema, Compose or startup changes.
The isolated checks covered absent marking, pending and expired QR, confirmed
start and duplicate retry, manual correction and cancellation, and future plan
edits through the authenticated endpoints. Focused regression suite: 69 passed.
The deployed version label, public health and server commit matched. The
affected procurement preview matched Day Control on two historical dates,
including a manual working-day correction and an automatic day off.
Physical phone and a fresh production QR transition were not run.

The first attempt stopped before archive transfer because the exact source was
not yet an ancestor of the deployment branch. Its optional maintenance pass
left insufficient capacity. The retry used the same image, after publishing its
source and removing only regenerable APT caches. The ordinary precheck and the
installer both preserved the configured 15 GiB reserve.
