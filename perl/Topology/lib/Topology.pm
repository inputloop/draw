package Topology;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors

use strict;
use warnings;

our $VERSION = '0.01';

1;
__END__

=head1 NAME

Topology - draw what you have, from the repositories that describe it

=head1 DESCRIPTION

Topology reads git repositories (and the F<TOPOLOGY.md> files in them),
keeps what it learns as small files (L<Topology::Graph>), sorts it by four
pillars (L<Topology::Taxonomy>), and serves it to a browser app that draws
it with TopoForge.  Each piece can be switched off (L<Topology::Config>),
down to just the browser app's files on disk.

=head1 THE MODULES, AND HOW EACH IS WRITTEN

  Topology::Config     classic (package + bless)    the feature ladder
  Topology::CSV        classic (plain subs)         the CSV TopoForge opens
  Topology::Build      classic (plain subs)         repositories -> graph
  Topology::Doc        class + classic subs         TOPOLOGY.md, show private
  Topology::Repo       class                        a repository and its credential
  Topology::Graph      class                        the k/v graph on disk
  Topology::Taxonomy   class                        the four pillars
  Topology::Server     class + async method         the graph API

Classic where an operator reads it; the new class syntax where it holds
data.  F<doc/CLASSIC-BRIDGE.pod> maps one onto the other.

=head1 LICENCE

GPL-3.0-or-later OR LGPL-3.0-or-later, your choice.

=cut
