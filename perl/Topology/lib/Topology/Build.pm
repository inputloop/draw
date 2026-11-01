package Topology::Build 0.01;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::Build -- turn checked-out repositories into graph cells.
#
# Classic style: one exported sub and a few helpers.  For each repository
# it writes a row "repo:NAME"; for each TOPOLOGY.md or .topology.md found
# at the top or up to two folders down, a row "NAME/PATH"; for each name
# a TOPOLOGY.md lists under contains or connects, a row "thing:NAME"
# unless a row already answers to that name.

use v5.36;                     # strict, warnings, say, signatures (5.36+)
use File::Find ();
use Topology::Doc;

sub from_checkouts {
    my (%a) = @_;
    my ($graph, $tax, $root, $repos) = @a{qw(graph taxonomy root repos)};
    my @seen;
    for my $repo (@$repos) {
        my $dir = "$root/$repo";
        next unless -d $dir;
        my $rid = "repo:$repo";
        $graph->put($rid, kind => 'storage');
        $graph->put($rid, name => $repo);
        $graph->put($rid, pillar => 'place');
        $graph->put($rid, layer => 'operational');
        push @seen, _containers($graph, $tax, $dir, $rid, $repo);
    }
    # names that were only mentioned get a row of their own
    my %named = map { lc($graph->get($_, 'name') // '') => $_ } $graph->rows;
    for my $row ($graph->rows) {
        for my $rel (qw(contains connects)) {
            my $v = $graph->get($row, $rel) // next;
            my @ids;
            for my $n (grep { length } split /\n/, $v) {
                my $id = $named{ lc $n } // "thing:$n";
                unless (defined $graph->get($id, 'kind')) {
                    $graph->put($id, kind => 'rounded');
                    $graph->put($id, name => $n);
                    $graph->put($id, pillar => 'part');
                    $named{ lc $n } = $id;
                }
                push @ids, $id;
            }
            $graph->put($row, $rel => join "\n", @ids);
        }
    }
    return @seen;
}

sub _containers {
    my ($graph, $tax, $dir, $rid, $repo) = @_;
    my @found;
    File::Find::find({ no_chdir => 1, wanted => sub {
        my $depth = ($File::Find::name =~ tr{/}{}) - ($dir =~ tr{/}{});
        return if -l $_;    # links are never followed (they could point at a key)
        if (-d _) {
            # read the top and up to two folders down (a/b/TOPOLOGY.md)
            $File::Find::prune = 1 if $depth >= 3 || /\/\.git$/;
            return;
        }
        return unless m{/(TOPOLOGY\.md|\.topology\.md)$};
        my $d = $File::Find::dir;
        return if grep { $_ eq $d } @found;    # both names read once, together
        push @found, $d;
    } }, $dir);
    for my $d (sort @found) {
        my @docs = Topology::Doc::read_dir($d);
        my $rel = $d eq $dir ? '' : substr($d, length($dir) + 1);
        my $id = length $rel ? "$repo/$rel" : $rid;
        my %meta;
        for my $doc (reverse @docs) { $meta{$_} = $doc->meta($_) for $doc->meta_keys }
        my $kind = $meta{kind} // (length $rel ? 'zone' : 'storage');
        $graph->put($id, kind => $kind);
        $graph->put($id, name => $meta{name} // ($rel || $repo));
        $graph->put($id, pillar => $tax->pillar_for($kind) // 'gap');
        $graph->put($id, layer => $meta{layer}) if defined $meta{layer};
        $graph->put($id, container => $rid) if length $rel;
        # paths as the repository names them, never where this server keeps it
        my $rp = sub { "$repo:" . substr($_[0]->path, length($dir) + 1) };
        $graph->put($id, source => join "\n", map { $rp->($_) } @docs);
        my @pub = map { $_->public_lines } @docs;
        $graph->put($id, notes => join "\n", @pub) if grep { /\S/ } @pub;
        my @priv = map { $_->private_lines } @docs;
        $graph->put($id, private => join "\n", @priv) if grep { /\S/ } @priv;
        $graph->put($id, declared_private => join "\n",
            map { $rp->($_) . ' ' . ($_->declared_private // '-') } @docs);
        for my $rel_key (qw(contains connects)) {
            my @l = map { $_->list($rel_key) } @docs;
            $graph->put($id, $rel_key => join "\n", @l) if @l;
        }
        for my $k (grep { !/^(kind|name|layer|private|contains|connects)$/ } keys %meta) {
            $graph->put($id, "meta.$k" => $meta{$k});
        }
    }
    return @found;
}

1;
