package Topology::CSV;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::CSV -- the graph as a CSV that TopoForge opens with ?load=.
# Classic style.  The same function is written in www/js/topology-core.js
# (graphToCSV); t/30-graph.t and tests/js/ check both against TopoForge's
# own column list, read out of www/topoforge/index.html.

use strict;
use warnings;

our $VERSION = '0.01';
our @COLS = qw(name type hostname ip mac vlan status vendor model notes container connects_to x y);

sub cell {
    my ($v) = @_;
    $v = '' unless defined $v;
    return $v unless $v =~ /[",\r\n]/;
    $v =~ s/"/""/g;
    return qq{"$v"};
}

sub graph_to_csv {
    my ($data) = @_;
    my %name = map { $_->{id} => ($_->{name} // $_->{id}) } @{ $data->{nodes} };
    my %conn;
    push @{ $conn{ $_->{from} } }, $name{ $_->{to} } // $_->{to}
        for grep { $_->{rel} eq 'connects' } @{ $data->{links} };
    my @out = (join ',', @COLS, qw(pillar layer tf_ref));
    for my $n (@{ $data->{nodes} }) {
        my %row = map { $_ => '' } @COLS;
        $row{name} = $n->{name} // $n->{id};
        $row{type} = $n->{kind} // 'server';
        $row{notes} = (grep { /\S/ && !/^#/ } split /\n/, $n->{notes} // '')[0] // '';   # first line of prose
        $row{container} = defined $n->{container} ? ($name{ $n->{container} } // '') : '';
        $row{connects_to} = join ';', @{ $conn{ $n->{id} } // [] };
        push @out, join ',', map { cell($_) } (map { $row{$_} } @COLS), $n->{pillar} // '', $n->{layer} // '', $n->{id};
    }
    return join("\r\n", @out) . "\r\n";
}

1;
