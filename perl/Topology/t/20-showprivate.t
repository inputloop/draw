#!perl
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# The shared cases of spec/fixtures/showprivate.json, read by Perl.
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use JSON::PP ();
use FindBin;
use lib "$FindBin::Bin/../lib";
use Topology::Doc;

my $fx = $ENV{TOPOLOGY_FIXTURES} // "$FindBin::Bin/../../../spec/fixtures";
open my $fh, '<:raw', "$fx/showprivate.json" or plan skip_all => "no fixtures at $fx";
my $c = JSON::PP->new->utf8->decode(do { local $/; <$fh> });

my %doc = map { $_ => Topology::Doc::File->new(path => $_, text => $c->{files}{$_}) }
          keys %{ $c->{files} };

for my $p (@{ $c->{parse} }) {
    my $d = $doc{ $p->{file} };
    is_deeply({ map { $_ => $d->meta($_) } $d->meta_keys }, $p->{meta}, "$p->{file}: front matter");
    is_deeply([ $d->public_lines  ], $p->{public},  "$p->{file}: public lines");
    is_deeply([ $d->private_lines ], $p->{private}, "$p->{file}: private lines");
    is($d->declared_private, $p->{declared}, "$p->{file}: declared");
}

for my $r (@{ $c->{resolve} }) {
    my $got = Topology::Doc::resolve(
        container => $r->{container}, global => $r->{global},
        docs => [ map { $doc{$_} } @{ $r->{docs} } ]);
    is(!!$got->{show}, !!$r->{show}, "$r->{name}: show");
    is($got->{by}, $r->{by}, "$r->{name}: by");
    is(defined $got->{seam} ? 1 : 0, $r->{seam} ? 1 : 0, "$r->{name}: seam");
}

for my $e (@{ $c->{errors} }) {
    my $ok = eval { Topology::Doc::resolve(container => $e->{container}, global => $e->{global}); 1 };
    ok(!$ok && $@ =~ /show-private/, "$e->{name}: refused in words");
}

done_testing;
