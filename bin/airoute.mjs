#!/usr/bin/env node

/**
 * AIRoute CLI bin entry.
 *
 * Must be a real file (not a symlink to omniroute.mjs): `npm pack` omits
 * in-package symlinks, which made `bin/airoute.mjs` disappear from the
 * publish tarball and failed check:pack-artifact.
 *
 * Implementation stays in omniroute.mjs for OmniRoute-compat pathing.
 */
import "./omniroute.mjs";
