package Topology::Taxonomy 0.01;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::Taxonomy -- the four pillars (place, part, path, person), the
# two axes (layer, act), the tensions between pillars, and the words the
# app uses, read from taxonomy/pillars.json.  design/TAXONOMY.org is the
# prose reading of the same data.

use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Feature::Compat::Class;
use JSON::PP ();

class Topology::Taxonomy {
    field $file :param :reader;
    field $data;
    field %pillar_of_shape;
    field %word;

    ADJUST {
        open my $fh, '<:raw', $file or die "$file: $!\n";
        $data = JSON::PP->new->decode(do { local $/; <$fh> });
        for my $p (@{ $data->{pillars} }) {
            $pillar_of_shape{$_} //= $p->{id} for @{ $p->{shapes} };
        }
        $word{ lc $_->{word} } = $_ for @{ $data->{words} };
    }

    method data      { $data }
    method pillars   { map { $_->{id} } @{ $data->{pillars} } }
    method tensions  { @{ $data->{tensions} } }

    # The pillar a TopoForge shape (or one of our kinds) sits in; undef
    # when the taxonomy does not say, which callers show as a gap.
    method pillar_for ($kind) { $pillar_of_shape{ lc($kind // '') } }

    method sense ($w) { $word{ lc $w } }

    # Words with no row: the order of work for the taxonomy, not errors.
    method gaps (@words) { grep { !exists $word{ lc $_ } } @words }

    method axis_values ($axis) {
        my ($a) = grep { $_->{id} eq $axis } @{ $data->{axes} } or return ();
        return map { $_->{id} } @{ $a->{values} };
    }
}

1;
